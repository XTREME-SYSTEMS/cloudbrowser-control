import { createContext, useContext } from "react";

/**
 * Carries the current case's identity down to the deep-search widgets, so a
 * search started from inside a case inherits the authority recorded on that
 * case instead of restating it — or, worse, skipping it.
 */
const CaseAuthorizationContext = createContext({ heir_search_id: null });

export function CaseAuthorizationProvider({ heir_search_id = null, children }) {
  return (
    <CaseAuthorizationContext.Provider value={{ heir_search_id: heir_search_id || null }}>
      {children}
    </CaseAuthorizationContext.Provider>
  );
}

export function useCaseAuthorization() {
  return useContext(CaseAuthorizationContext);
}