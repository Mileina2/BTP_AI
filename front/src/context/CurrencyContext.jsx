import { createContext, useContext, useEffect, useMemo } from "react";
import { getCurrency, DEFAULT_CURRENCY_CODE } from "../lib/currency";
import { setFormatCurrency } from "../lib/format";

const CurrencyContext = createContext(getCurrency(DEFAULT_CURRENCY_CODE));

export function CurrencyProvider({ organization, children }) {
  const currency = useMemo(
    () => getCurrency(organization?.devise || DEFAULT_CURRENCY_CODE),
    [organization?.devise]
  );

  useEffect(() => {
    setFormatCurrency(currency);
  }, [currency]);

  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
