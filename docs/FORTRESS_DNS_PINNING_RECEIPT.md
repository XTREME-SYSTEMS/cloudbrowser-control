# Fortress DNS Pinning Receipt

- Tested commit: 38c1f7cb780ad68f145491c650b70260e3175c41
- Workflow run: 32335871279
- Pinning/source contracts: failure
- Browser integration and soak: failure
- Overall: FAIL
- Final outbound connection model: validated DNS answer selected and connected by IP through local egress proxy
- Playwright request guard: ENABLED as defense in depth
- Service workers: BLOCKED
- Network-layer destination firewall: NOT VERIFIED / still recommended defense in depth
- Production deploy: NOT EXECUTED
- Main write/merge: NOT EXECUTED
