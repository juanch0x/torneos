# Delta for Routing

## MODIFIED Requirements

### Requirement: Results Tab in TournamentLayout

`TournamentLayout` MUST expose a third `Tabs.Tab` labelled "Resultados" with route slug `results`. The tab MUST always be accessible (never hidden or disabled). The active tab MUST reflect the current URL segment. The layout SHOULD also host shared advisory cockpit guidance when a tournament is loaded, but that guidance MUST NOT become a navigation signal, route guard, redirect, or tab blocker.
(Previously: `TournamentLayout` only specified the results tab visibility and active-state behavior.)

#### Scenario: Third tab always visible

- GIVEN the user is on any `/tournaments/:id/*` sub-route
- WHEN `TournamentLayout` renders
- THEN three tabs are visible: groups, fixture, and "Resultados"

#### Scenario: Active tab reflects URL

- GIVEN the URL is `/tournaments/:id/results`
- WHEN `TournamentLayout` renders
- THEN the "Resultados" tab appears active

#### Scenario: Guidance does not own navigation

- GIVEN shared cockpit guidance recommends a next action
- WHEN the user selects any tournament tab or opens a valid child URL
- THEN the selected URL-owned route renders normally
- AND the guidance does not redirect, disable, or hide navigation
