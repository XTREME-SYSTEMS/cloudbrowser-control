# Fortress DNS Pinning Receipt

- Tested commit: 42e293704db04ab94ef22928e75edb161732fe33
- Workflow run: 32336233525
- Pinning/source contracts: failure
- Browser integration and soak: failure
- Overall: FAIL
- Final outbound connection model: validated DNS answer selected and connected by IP through local egress proxy
- Playwright request guard: ENABLED as defense in depth
- Service workers: BLOCKED
- Network-layer destination firewall: NOT VERIFIED / still recommended defense in depth
- Production deploy: NOT EXECUTED
- Main write/merge: NOT EXECUTED
