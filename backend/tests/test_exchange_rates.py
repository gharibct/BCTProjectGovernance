from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.reference_data import ExchangeRateWrite
from app.services.exchange_rates import convert_to_usd


def test_usd_converts_one_to_one_without_a_rate():
    assert convert_to_usd(Decimal("250000"), "USD", None) == Decimal("250000.00")


def test_non_usd_multiplies_by_rate_and_rounds_to_cents():
    assert convert_to_usd(Decimal("1000"), "EUR", Decimal("1.0876")) == Decimal("1087.60")
    assert convert_to_usd(Decimal("100.005"), "OMR", Decimal("2.6")) == Decimal("260.01")


def test_missing_rate_amount_or_currency_gives_none():
    assert convert_to_usd(Decimal("1000"), "EUR", None) is None
    assert convert_to_usd(None, "EUR", Decimal("1.1")) is None
    assert convert_to_usd(Decimal("1000"), None, Decimal("1.1")) is None


def test_write_schema_normalises_and_validates():
    assert ExchangeRateWrite(currency=" eur ", rate_to_usd=Decimal("1.1")).currency == "EUR"
    for bad in ({"currency": "USD", "rate_to_usd": "1"}, {"currency": "EU", "rate_to_usd": "1"}, {"currency": "EUR", "rate_to_usd": "0"}):
        with pytest.raises(ValidationError):
            ExchangeRateWrite(**bad)
