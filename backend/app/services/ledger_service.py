from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.models import ColumnMapping, CustomerRate, Product, ProductRate


def _load_column_mappings(db: Session) -> Dict[str, Product]:
    all_products = db.query(Product).filter(Product.is_active.is_(True)).all()
    product_by_id: Dict[int, Product] = {p.id: p for p in all_products}

    active_mappings: List[ColumnMapping] = (
        db.query(ColumnMapping)
        .filter(ColumnMapping.active.is_(True))
        .all()
    )
    result: Dict[str, Product] = {}
    for mapping in active_mappings:
        product = product_by_id.get(mapping.product_id)
        if not product and mapping.product_id:
            product = db.query(Product).filter(Product.id == mapping.product_id).first()
            if product:
                product_by_id[product.id] = product
        if product and mapping.column_code:
            result[mapping.column_code.strip().upper()] = product

    # Fallback: if not explicitly configured in ColumnMapping, match by Product.product_code or Product.name
    for p in all_products:
        if p.product_code:
            code_clean = p.product_code.strip().upper()
            if code_clean and code_clean not in result:
                result[code_clean] = p
        if p.name:
            name_clean = p.name.strip().upper()
            if name_clean and name_clean not in result:
                result[name_clean] = p

    # Smart fallback for common fish trade abbreviations
    for p in all_products:
        p_name_up = (p.name or "").strip().upper()
        p_code_up = (p.product_code or "").strip().upper()
        if ("ROHU" in p_name_up or "RPHU" in p_name_up) and "R" not in result:
            result["R"] = p
        if ("TILAPIA" in p_name_up or "TEST" in p_name_up) and "T" not in result:
            result["T"] = p
        if ("KATLA" in p_name_up or "CATLA" in p_name_up) and "K" not in result:
            result["K"] = p
        if "SILVER" in p_name_up:
            if "SIL" not in result: result["SIL"] = p
            if "SI" not in result: result["SI"] = p
        if "PARDA" in p_name_up or "PANGAS" in p_name_up or "PANGASH" in p_name_up:
            if "PD" not in result: result["PD"] = p
        if "PAPAR" in p_name_up or "PAPLATE" in p_name_up:
            if "PP" not in result: result["PP"] = p
            if "P" not in result: result["P"] = p

    return result


def _resolve_rate(
    product: Product,
    customer_id: Optional[int],
    db: Session,
    is_live: bool = False,
    customer_rates_map: Optional[Dict[tuple[int, int], CustomerRate]] = None,
    product_rates_map: Optional[Dict[int, ProductRate]] = None,
) -> tuple[Optional[Decimal], str]:
    """
    Returns (rate_or_None, rate_source_string).
    If is_live is True, priority:
        Customer Live Rate > Product Live Rate > Customer Regular Rate > Product Regular Rate > None
    If is_live is False, priority:
        CustomerRate > ProductRate > None
    """
    def _get_cr(c_id: int, p_id: int) -> Optional[CustomerRate]:
        if customer_rates_map is not None:
            return customer_rates_map.get((c_id, p_id))
        return (
            db.query(CustomerRate)
            .filter(
                CustomerRate.customer_id == c_id,
                CustomerRate.product_id == p_id,
            )
            .first()
        )

    def _get_pr(p_id: int) -> Optional[ProductRate]:
        if product_rates_map is not None:
            return product_rates_map.get(p_id)
        return (
            db.query(ProductRate)
            .filter(ProductRate.product_id == p_id)
            .first()
        )

    if is_live:
        # 1. Customer live rate override
        if customer_id is not None:
            cr = _get_cr(customer_id, product.id)
            if cr is not None and cr.live_rate is not None:
                return Decimal(str(cr.live_rate)), "customer_live"

        # 2. Base live rate
        pr = _get_pr(product.id)
        if pr is not None and pr.live_rate is not None:
            return Decimal(str(pr.live_rate)), "base_live"

        # 3. Fallback: regular customer rate
        if customer_id is not None:
            cr = _get_cr(customer_id, product.id)
            if cr is not None and cr.rate is not None:
                return Decimal(str(cr.rate)), "customer"

        # 4. Fallback: regular base rate
        if pr is not None and pr.rate is not None:
            return Decimal(str(pr.rate)), "base"

        return None, "none"

    # Standard (non-live) rate resolution
    if customer_id is not None:
        cr = _get_cr(customer_id, product.id)
        if cr is not None and cr.rate is not None:
            return Decimal(str(cr.rate)), "customer"

    pr = _get_pr(product.id)
    if pr is not None and pr.rate is not None:
        return Decimal(str(pr.rate)), "base"

    return None, "none"


def resolve_ledger_rates(
    draft: Dict[str, Any],
    db: Session,
) -> Dict[str, Any]:
    """
    Enrich every cell in the Gemini draft with authoritative DB product/rate info.

    Fields added to each cell:
        resolved_product_id   - int or None
        resolved_product_code - str or None  (e.g. "ON001")
        resolved_product_name - str or None  (e.g. "Onion")
        resolved_unit         - str or None  (e.g. "kg")
        resolved_rate         - float or None
        resolved_amount       - float or None (Decimal qty * rate)
        rate_source           - "customer_live" | "base_live" | "customer" | "base" | "none" | "no_mapping"
        is_live               - bool (True if circled / live fish)
        mapping_issue         - str or None  (goes to Needs Review)

    The original Gemini 'rate' field is preserved for backward compat but
    is NOT used for resolved_amount.
    """
    col_product_map: Dict[str, Product] = _load_column_mappings(db)
    rows: List[Dict[str, Any]] = draft.get("rows", [])

    # Preload all ProductRates and CustomerRates to avoid N+1 queries per cell
    product_rates = db.query(ProductRate).all()
    product_rates_map: Dict[int, ProductRate] = {pr.product_id: pr for pr in product_rates}

    customer_ids = {
        row.get("customer_id")
        for row in rows
        if row.get("customer_id") is not None
    }
    if customer_ids:
        customer_rates = (
            db.query(CustomerRate)
            .filter(CustomerRate.customer_id.in_(customer_ids))
            .all()
        )
    else:
        customer_rates = []
    customer_rates_map: Dict[tuple[int, int], CustomerRate] = {
        (cr.customer_id, cr.product_id): cr for cr in customer_rates
    }

    for row in rows:
        customer_id: Optional[int] = row.get("customer_id")
        cells: Dict[str, Any] = row.get("cells", {})

        for col_code, cell_raw in list(cells.items()):
            if isinstance(cell_raw, (int, float)):
                cell_data: Dict[str, Any] = {"quantity": cell_raw}
                cells[col_code] = cell_data
            elif isinstance(cell_raw, dict):
                cell_data = cell_raw
            else:
                cell_data = {}
                cells[col_code] = cell_data

            col_code_clean = str(col_code).strip().upper()
            product: Optional[Product] = col_product_map.get(col_code_clean)

            # Determine whether this cell is a circled / live fish entry
            c_val = cell_data.get("circled_value")
            is_live = bool(
                cell_data.get("is_live") or
                c_val or
                cell_data.get("is_circled") or
                (isinstance(cell_data.get("tag"), str) and "live" in cell_data.get("tag", "").lower())
            )

            # If quantity was empty but circled_value has a numeric string (e.g. "40" or "(40)"), extract it as quantity
            qty_raw = cell_data.get("quantity")
            if (qty_raw is None or str(qty_raw).strip() == "") and c_val:
                clean_num = "".join(c for c in str(c_val) if c.isdigit() or c == ".")
                if clean_num:
                    try:
                        cell_data["quantity"] = float(clean_num)
                        is_live = True
                    except Exception:
                        pass

            cell_data["is_live"] = is_live
            if is_live and not c_val and cell_data.get("quantity") is not None:
                cell_data["circled_value"] = str(cell_data["quantity"])

            if product is None:
                cell_data["resolved_product_id"] = None
                cell_data["resolved_product_code"] = None
                cell_data["resolved_product_name"] = None
                cell_data["resolved_unit"] = None
                cell_data["resolved_rate"] = None
                cell_data["resolved_amount"] = None
                cell_data["rate_source"] = "no_mapping"
                cell_data["mapping_issue"] = (
                    f"Product mapping not found for column {col_code}"
                )
                continue

            db_rate, rate_source = _resolve_rate(
                product,
                customer_id,
                db,
                is_live=is_live,
                customer_rates_map=customer_rates_map,
                product_rates_map=product_rates_map,
            )

            cell_data["resolved_product_id"] = product.id
            cell_data["resolved_product_code"] = product.product_code
            cell_data["resolved_product_name"] = product.name
            cell_data["resolved_unit"] = product.unit

            if db_rate is None:
                cell_data["resolved_rate"] = None
                cell_data["resolved_amount"] = None
                cell_data["rate_source"] = "none"
                cell_data["mapping_issue"] = (
                    f"Product rate not configured for "
                    f"{product.product_code or product.name}"
                )
            else:
                qty_raw = cell_data.get("quantity")
                try:
                    qty_dec = Decimal(str(qty_raw)) if qty_raw is not None else None
                except Exception:
                    qty_dec = None

                if qty_dec is not None:
                    amount = (qty_dec * db_rate).quantize(
                        Decimal("0.01"), rounding=ROUND_HALF_UP
                    )
                    cell_data["resolved_amount"] = float(amount)
                else:
                    cell_data["resolved_amount"] = None

                cell_data["resolved_rate"] = float(db_rate)
                cell_data["rate_source"] = rate_source
                
                # If it's a live fish but using a non-live fallback, give a helpful non-blocking note
                if is_live and rate_source not in ("customer_live", "base_live"):
                    cell_data["mapping_issue"] = f"Live rate not configured for {product.name} (using regular rate fallback)"
                else:
                    cell_data["mapping_issue"] = None

    return draft
