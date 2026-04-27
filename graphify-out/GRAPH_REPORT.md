# Graph Report - .  (2026-04-26)

## Corpus Check
- Corpus is ~44,226 words - fits in a single context window. You may not need a graph.

## Summary
- 425 nodes · 420 edges · 23 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth & SDK Core|Auth & SDK Core]]
- [[_COMMUNITY_Client API Interactions|Client API Interactions]]
- [[_COMMUNITY_Schema & Live Data APIs|Schema & Live Data APIs]]
- [[_COMMUNITY_UI Primitives & Hooks|UI Primitives & Hooks]]
- [[_COMMUNITY_Server Initialization|Server Initialization]]
- [[_COMMUNITY_Debug Event Collector|Debug Event Collector]]
- [[_COMMUNITY_External Storage Integration|External Storage Integration]]
- [[_COMMUNITY_LLM Interactions|LLM Interactions]]
- [[_COMMUNITY_Client Auth Routing|Client Auth Routing]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]

## God Nodes (most connected - your core abstractions)
1. `apiRequest()` - 14 edges
2. `SDKServer` - 12 edges
3. `startServer()` - 7 edges
4. `authMiddleware()` - 6 edges
5. `installUiEventListeners()` - 5 edges
6. `storagePut()` - 5 edges
7. `invokeLLM()` - 5 edges
8. `OAuthService` - 5 edges
9. `logUiEvent()` - 4 edges
10. `getLoginUrl()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `generateImage()` --calls--> `storagePut()`  [INFERRED]
  C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\imageGeneration.ts → C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\storage.ts
- `startServer()` --calls--> `registerStorageProxy()`  [INFERRED]
  C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\index.ts → C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\storageProxy.ts
- `startServer()` --calls--> `registerOAuthRoutes()`  [INFERRED]
  C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\index.ts → C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\oauth.ts
- `startServer()` --calls--> `registerSchemaApiRoutes()`  [INFERRED]
  C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\index.ts → C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\schemaApi.ts
- `startServer()` --calls--> `setupVite()`  [INFERRED]
  C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\index.ts → C:\Users\91801\Documents\GitHub\investment-portfolio-system\server\_core\vite.ts

## Communities

### Community 0 - "Auth & SDK Core"
Cohesion: 0.12
Nodes (7): createContext(), getDb(), getUserByOpenId(), upsertUser(), isNonEmptyString(), OAuthService, SDKServer

### Community 1 - "Client API Interactions"
Cohesion: 0.15
Nodes (18): addWatchlistItem(), apiRequest(), buyAsset(), fetchAssets(), fetchDefaultPortfolio(), fetchMarketDaily(), fetchMarketHistory(), fetchPortfolio() (+10 more)

### Community 2 - "Schema & Live Data APIs"
Cohesion: 0.18
Nodes (17): authMiddleware(), buildPortfolioResponse(), ensureUserIdByEmail(), fetchHistoricalPrices(), fetchLivePrices(), fetchLiveQuoteSnapshots(), fetchYahooQuoteRows(), getAssetsWithFallback() (+9 more)

### Community 3 - "UI Primitives & Hooks"
Cohesion: 0.13
Nodes (6): useDialogComposition(), Input(), MapView(), Textarea(), useComposition(), usePersistFn()

### Community 4 - "Server Initialization"
Cohesion: 0.15
Nodes (8): findAvailablePort(), isPortAvailable(), startServer(), registerOAuthRoutes(), registerSchemaApiRoutes(), registerStorageProxy(), serveStatic(), setupVite()

### Community 5 - "Debug Event Collector"
Cohesion: 0.25
Nodes (13): compactText(), describeElement(), elText(), formatArg(), formatArgs(), getInputValueSafe(), installUiEventListeners(), isSensitiveField() (+5 more)

### Community 8 - "External Storage Integration"
Cohesion: 0.39
Nodes (7): generateImage(), appendHashSuffix(), getForgeConfig(), normalizeKey(), storageGet(), storageGetSignedUrl(), storagePut()

### Community 9 - "LLM Interactions"
Cohesion: 0.36
Nodes (7): assertApiKey(), ensureArray(), invokeLLM(), normalizeMessage(), normalizeResponseFormat(), normalizeToolChoice(), resolveApiUrl()

### Community 10 - "Client Auth Routing"
Cohesion: 0.29
Nodes (4): getLoginUrl(), Home(), redirectToLoginIfUnauthorized(), useAuth()

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (2): SidebarMenuButton(), useSidebar()

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (2): ForbiddenError(), HttpError

### Community 18 - "Community 18"
Cohesion: 0.53
Nodes (4): FormControl(), FormDescription(), FormMessage(), useFormField()

### Community 20 - "Community 20"
Cohesion: 0.6
Nodes (5): buildEndpointUrl(), isNonEmptyString(), notifyOwner(), trimValue(), validatePayload()

### Community 21 - "Community 21"
Cohesion: 0.6
Nodes (3): ensureLogDir(), trimLogFile(), writeToLogFile()

### Community 22 - "Community 22"
Cohesion: 0.4
Nodes (1): ErrorBoundary

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (2): CarouselNext(), useCarousel()

### Community 27 - "Community 27"
Cohesion: 0.4
Nodes (2): Toaster(), useTheme()

### Community 28 - "Community 28"
Cohesion: 0.83
Nodes (3): handleKeyDown(), handleSubmit(), scrollToBottom()

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (2): handleDialogKeyDown(), handleDialogSubmit()

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (2): getSessionCookieOptions(), isSecureRequest()

### Community 39 - "Community 39"
Cohesion: 0.83
Nodes (3): getFileExtension(), getLanguageName(), transcribeAudio()

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (2): getMapsConfig(), makeRequest()

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (2): ensureSchemaUserByEmail(), getPool()

## Knowledge Gaps
- **Thin community `Community 16`** (7 nodes): `sidebar.tsx`, `cn()`, `handleKeyDown()`, `SidebarMenu()`, `SidebarMenuButton()`, `SidebarMenuItem()`, `useSidebar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (7 nodes): `BadRequestError()`, `ForbiddenError()`, `HttpError`, `.constructor()`, `NotFoundError()`, `UnauthorizedError()`, `errors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (5 nodes): `ErrorBoundary.tsx`, `ErrorBoundary`, `.constructor()`, `.getDerivedStateFromError()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (5 nodes): `Carousel()`, `CarouselNext()`, `cn()`, `useCarousel()`, `carousel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (5 nodes): `sonner.tsx`, `ThemeContext.tsx`, `Toaster()`, `ThemeProvider()`, `useTheme()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (4 nodes): `ComponentShowcase.tsx`, `handleChatSend()`, `handleDialogKeyDown()`, `handleDialogSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (4 nodes): `getSessionCookieOptions()`, `isIpAddress()`, `isSecureRequest()`, `cookies.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (3 nodes): `getMapsConfig()`, `makeRequest()`, `map.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (3 nodes): `ensureSchemaUserByEmail()`, `getPool()`, `schemaUser.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `authMiddleware()` connect `Schema & Live Data APIs` to `Auth & SDK Core`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `registerSchemaApiRoutes()` connect `Server Initialization` to `Schema & Live Data APIs`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `startServer()` (e.g. with `registerStorageProxy()` and `registerOAuthRoutes()`) actually correct?**
  _`startServer()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Auth & SDK Core` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `UI Primitives & Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._