/**
 * Bedrock Automated Evaluation Harness
 * 15-20 test ideas per profile, run against every model, scored automatically
 * on format, topic, and forbidden terms. Re-run after every prompt change,
 * and drop models that stay unreliable for a task.
 */

import { type UseCaseProfileId, getProfileById } from './useCaseProfiles';
import { testPrompt } from './api';

export type EvalDifficulty = 'simple' | 'medium' | 'complex' | 'adversarial';

export interface EvalTestCase {
  id: string;
  profileId: UseCaseProfileId;
  title: string;
  idea: string;
  difficulty: EvalDifficulty;
  expectedTopicKeywords: string[];
  forbiddenTerms: string[];
  requiredMarkers: string[];
  description: string;
}

export interface FormatScoreResult {
  score: number;
  issues: string[];
  details: {
    hasTitle: boolean;
    hasRequiredMarkers: boolean;
    hasValidStructure: boolean;
    noRawJsonLeak: boolean;
    meetsWordCount: boolean;
  };
}

export interface TopicScoreResult {
  score: number;
  keywordCoverage: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  driftPenalties: string[];
}

export interface ForbiddenScoreResult {
  score: number;
  violations: {
    term: string;
    count: number;
    context: string;
  }[];
}

export type ScoreGrade = 'S' | 'A' | 'B' | 'C' | 'F';

export interface EvalResult {
  testCaseId: string;
  profileId: UseCaseProfileId;
  modelId: string;
  timestamp: number;
  durationMs: number;
  output: string;
  format: FormatScoreResult;
  topic: TopicScoreResult;
  forbidden: ForbiddenScoreResult;
  compositeScore: number;
  grade: ScoreGrade;
  passed: boolean;
  critique: string;
}

export type ModelReliabilityStatus = 'RELIABLE' | 'DEGRADED' | 'DROPPED';

export interface ModelReliabilityRecord {
  modelId: string;
  profileId: UseCaseProfileId;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  passRate: number;
  avgFormatScore: number;
  avgTopicScore: number;
  avgForbiddenScore: number;
  avgCompositeScore: number;
  status: ModelReliabilityStatus;
  consecutiveFailures: number;
  isDropped: boolean;
  dropReason?: string;
  lastUpdated: number;
}

export interface EvalSuiteResult {
  runId: string;
  timestamp: number;
  promptVersionHash: string;
  profilesTested: UseCaseProfileId[];
  modelsTested: string[];
  totalTests: number;
  passedCount: number;
  failedCount: number;
  overallPassRate: number;
  avgFormatScore: number;
  avgTopicScore: number;
  avgForbiddenScore: number;
  avgCompositeScore: number;
  results: EvalResult[];
  reliabilityMatrix: ModelReliabilityRecord[];
  droppedModels: { modelId: string; profileId: UseCaseProfileId; reason: string }[];
}

/* =========================================================================
   15-20 TEST IDEAS PER PROFILE BENCHMARK DATASET (126 TOTAL BENCHMARKS)
   ========================================================================= */

export const EVAL_TEST_CASES: EvalTestCase[] = [
  // -------------------------------------------------------------
  // 1. CODING AGENT (18 Test Ideas)
  // -------------------------------------------------------------
  {
    id: 'code-01',
    profileId: 'coding_agent',
    title: 'CRDT Collaborative Markdown Editor',
    idea: 'A real-time collaborative markdown editor with CRDT and WebSockets',
    difficulty: 'complex',
    expectedTopicKeywords: ['CRDT', 'WebSocket', 'markdown', 'collaborative', 'sync', 'IndexedDB'],
    forbiddenTerms: ['// TODO', 'type any', ': any', 'as any', 'Certainly!'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Real-time synchronization engine with offline resilience and optimistic UI updates',
  },
  {
    id: 'code-02',
    profileId: 'coding_agent',
    title: 'Idempotent Webhook Processor in PostgreSQL',
    idea: 'High-throughput payment gateway webhook processor with idempotency in PostgreSQL',
    difficulty: 'complex',
    expectedTopicKeywords: ['webhook', 'idempotency', 'PostgreSQL', 'transaction', 'advisory lock', 'Stripe'],
    forbiddenTerms: ['// TODO', 'type any', 'componentWillMount', 'Sure, here is'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Zero-data-loss payment ledger ingestion pipeline with row-level locks',
  },
  {
    id: 'code-03',
    profileId: 'coding_agent',
    title: 'Interactive Kanban with Optimistic Rollbacks',
    idea: 'Interactive Kanban board with drag-and-drop, optimistic UI rollbacks, and offline sync',
    difficulty: 'medium',
    expectedTopicKeywords: ['Kanban', 'drag', 'optimistic', 'rollback', 'column', 'task'],
    forbiddenTerms: ['// TODO', ': any', '/* implement */', 'getStaticProps'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Frontend state-heavy workstation with accessible keyboard navigation',
  },
  {
    id: 'code-04',
    profileId: 'coding_agent',
    title: 'Multi-Tenant RBAC Authorization Engine',
    idea: 'Multi-tenant B2B SaaS RBAC authorization engine with JWT and Row Level Security',
    difficulty: 'complex',
    expectedTopicKeywords: ['multi-tenant', 'RBAC', 'RLS', 'JWT', 'permissions', 'tenant'],
    forbiddenTerms: ['// TODO', 'type any', 'hardcoded secret', 'As an AI model'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Fine-grained enterprise security barrier with tenant isolation',
  },
  {
    id: 'code-05',
    profileId: 'coding_agent',
    title: 'Redis Background Queue Worker',
    idea: 'FastAPI background worker pipeline with Redis queue and dead-letter handling',
    difficulty: 'medium',
    expectedTopicKeywords: ['Redis', 'worker', 'queue', 'dead-letter', 'retry', 'concurrency'],
    forbiddenTerms: ['// TODO', '/* add logic */', 'sleep(1000)', 'Certainly!'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Resilient asynchronous job consumer with exponential backoff',
  },
  {
    id: 'code-06',
    profileId: 'coding_agent',
    title: 'E-Commerce Cart Inventory Reservation',
    idea: 'E-commerce checkout cart with inventory reservation locks and Stripe webhook reconciliation',
    difficulty: 'complex',
    expectedTopicKeywords: ['inventory', 'reservation', 'cart', 'lock', 'reconciliation', 'checkout'],
    forbiddenTerms: ['// TODO', ': any', 'var ', 'Sure, here is'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'High-concurrency flash-sale checkout pipeline avoiding double-booking',
  },
  {
    id: 'code-07',
    profileId: 'coding_agent',
    title: 'Minimalist Developer Portfolio with Dark Mode',
    idea: 'Minimalist personal developer portfolio with dark mode and GitHub activity feed',
    difficulty: 'simple',
    expectedTopicKeywords: ['portfolio', 'dark mode', 'GitHub', 'projects', 'responsive'],
    forbiddenTerms: ['cryptocurrency', 'enterprise cart', 'escrow', '// TODO', 'type any'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Grounded portfolio without hallucinating unwarranted enterprise bloat',
  },
  {
    id: 'code-08',
    profileId: 'coding_agent',
    title: 'Web Audio API Real-Time Visualizer',
    idea: 'Audio streaming web app with Web Audio API visualizer and playlist caching',
    difficulty: 'medium',
    expectedTopicKeywords: ['AudioContext', 'AnalyserNode', 'visualizer', 'streaming', 'playlist', 'buffer'],
    forbiddenTerms: ['// TODO', ': any', 'componentWillMount'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'High-frame-rate canvas audio frequency rendering engine',
  },
  {
    id: 'code-09',
    profileId: 'coding_agent',
    title: 'Semantic Git Commit Rust CLI Tool',
    idea: 'CLI tool for semantic git commit messages and changelog generator in Rust',
    difficulty: 'medium',
    expectedTopicKeywords: ['CLI', 'commit', 'semantic', 'changelog', 'git', 'terminal'],
    forbiddenTerms: ['// TODO', 'unwrap()', 'panic!', 'Sure, here is'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Zero-panic systems CLI with POSIX exit codes and streaming stdout',
  },
  {
    id: 'code-10',
    profileId: 'coding_agent',
    title: 'OpenTelemetry Host Metrics Collector',
    idea: 'Telemetry agent that collects CPU/memory metrics and exports OpenTelemetry OTLP',
    difficulty: 'complex',
    expectedTopicKeywords: ['OpenTelemetry', 'OTLP', 'metrics', 'CPU', 'memory', 'exporter'],
    forbiddenTerms: ['// TODO', 'type any', ': any'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'High-precision systems metrics daemon with low overhead',
  },
  {
    id: 'code-11',
    profileId: 'coding_agent',
    title: 'AI Branching Node DAG Playground',
    idea: 'AI agent scratchpad with streaming token output and branching node history',
    difficulty: 'complex',
    expectedTopicKeywords: ['branching', 'DAG', 'streaming', 'tokens', 'nodes', 'tree'],
    forbiddenTerms: ['// TODO', '/* implement */', ': any'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Tree-of-thought node canvas with tactile drag-and-drop branches',
  },
  {
    id: 'code-12',
    profileId: 'coding_agent',
    title: 'Federated GraphQL Gateway',
    idea: 'GraphQL federated gateway combining inventory, user, and billing services',
    difficulty: 'complex',
    expectedTopicKeywords: ['GraphQL', 'federation', 'subgraph', 'gateway', 'schema', 'resolvers'],
    forbiddenTerms: ['// TODO', ': any', 'getServerSideProps'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Apollo/Subgraph microservice gateway with query batching',
  },
  {
    id: 'code-13',
    profileId: 'coding_agent',
    title: 'Multiplayer Real-Time Game Room',
    idea: 'Real-time multiplayer tic-tac-toe game with WebSocket rooms and reconnection',
    difficulty: 'simple',
    expectedTopicKeywords: ['WebSocket', 'rooms', 'reconnection', 'game state', 'players'],
    forbiddenTerms: ['enterprise billing', 'escrow', '// TODO', ': any'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Simple real-time state machine maintaining strict domain proportionality',
  },
  {
    id: 'code-14',
    profileId: 'coding_agent',
    title: 'Phishing Detection Browser Extension',
    idea: 'Browser extension that detects phishing URLs and highlights suspicious DOM links',
    difficulty: 'medium',
    expectedTopicKeywords: ['extension', 'phishing', 'URL', 'DOM', 'manifest', 'content script'],
    forbiddenTerms: ['// TODO', ': any', 'eval(', 'Certainly!'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Manifest V3 security extension with strict CSP directives',
  },
  {
    id: 'code-15',
    profileId: 'coding_agent',
    title: 'Optimized Photo Gallery with BlurHash',
    idea: 'Photo gallery app with image optimization, blurhash placeholders, and S3 uploads',
    difficulty: 'medium',
    expectedTopicKeywords: ['gallery', 'optimization', 'blurhash', 'S3', 'presigned URL', 'responsive'],
    forbiddenTerms: ['// TODO', ': any', 'React.createClass'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Performant visual media explorer with WebP/AVIF transformations',
  },
  {
    id: 'code-16',
    profileId: 'coding_agent',
    title: 'Safe Database Migration CLI Runner',
    idea: 'Automated database migration runner with rollback transaction safety checks',
    difficulty: 'complex',
    expectedTopicKeywords: ['migration', 'rollback', 'transaction', 'DDL', 'schema', 'checksum'],
    forbiddenTerms: ['// TODO', '/* add logic */', ': any'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Atomic schema evolution tool preventing locked table deadlocks',
  },
  {
    id: 'code-17',
    profileId: 'coding_agent',
    title: 'Zero-Knowledge Client Encrypted Vault',
    idea: 'Secure password manager vault with Argon2 client-side encryption and WebCrypto',
    difficulty: 'complex',
    expectedTopicKeywords: ['Argon2', 'WebCrypto', 'AES-GCM', 'vault', 'zero-knowledge', 'salt'],
    forbiddenTerms: ['// TODO', 'Math.random()', ': any', 'plaintext'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Cryptographic browser vault ensuring server has zero access to master secrets',
  },
  {
    id: 'code-18',
    profileId: 'coding_agent',
    title: 'Distributed Service Health Ping Monitor',
    idea: 'Microservice health probe dashboard with uptime pings and Slack alerts',
    difficulty: 'medium',
    expectedTopicKeywords: ['health probe', 'uptime', 'ping', 'latency', 'alerts', 'Slack webhook'],
    forbiddenTerms: ['// TODO', ': any', 'Sure, here is'],
    requiredMarkers: ['<role>', '<directives>', '<negative_constraints>', '<schema_contracts>', '<verification_protocol>'],
    description: 'Synthetic monitoring daemon with heartbeat probes and threshold alerting',
  },

  // -------------------------------------------------------------
  // 2. IMAGE GENERATION (18 Test Ideas)
  // -------------------------------------------------------------
  {
    id: 'img-01',
    profileId: 'image_generation',
    title: 'Rainy Cyberpunk Tokyo Market',
    idea: 'Cyberpunk neon street market in Tokyo during rain at midnight with reflections',
    difficulty: 'medium',
    expectedTopicKeywords: ['Tokyo', 'neon', 'rain', 'midnight', 'cyberpunk', 'reflections', '35mm'],
    forbiddenTerms: ['```typescript', 'npm install', 'function ', 'React component'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Atmospheric neon cityscape with wet pavement reflections and cinema optics',
  },
  {
    id: 'img-02',
    profileId: 'image_generation',
    title: 'Elderly Watchmaker Macro Lens',
    idea: 'Hyperrealistic portrait of an elderly watchmaker assembling gears with macro lens',
    difficulty: 'medium',
    expectedTopicKeywords: ['watchmaker', 'macro', 'gears', 'brass', 'depth of field', 'portrait'],
    forbiddenTerms: ['```typescript', 'const ', 'database', 'import React'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Intimate artisanal character portrait with microscopic mechanical precision',
  },
  {
    id: 'img-03',
    profileId: 'image_generation',
    title: 'Low-Poly 3D Floating Island',
    idea: 'Isometric low-poly 3D floating island with waterfalls and pine trees',
    difficulty: 'simple',
    expectedTopicKeywords: ['isometric', 'low-poly', 'floating island', 'waterfall', 'pine trees', '3D'],
    forbiddenTerms: ['npm run', 'PostgreSQL', 'function()', 'Certainly!'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Stylized polygonal miniature environment with soft studio GI lighting',
  },
  {
    id: 'img-04',
    profileId: 'image_generation',
    title: 'Bioluminescent Mystical Forest',
    idea: 'Ethereal mystical forest with bioluminescent mushrooms and floating mist',
    difficulty: 'medium',
    expectedTopicKeywords: ['bioluminescent', 'forest', 'mushrooms', 'mist', 'ethereal', 'cyan'],
    forbiddenTerms: ['```javascript', 'React', 'schema', 'TypeScript'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Otherworldly fairytale foliage with luminescent fungal spores',
  },
  {
    id: 'img-05',
    profileId: 'image_generation',
    title: 'Minimalist Scandinavian Living Room',
    idea: 'Minimalist Scandinavian living room interior with morning sunlight and monstera plant',
    difficulty: 'simple',
    expectedTopicKeywords: ['Scandinavian', 'interior', 'minimalist', 'sunlight', 'monstera', 'oak'],
    forbiddenTerms: ['```typescript', 'npm ', 'REST API', 'Sure, here is'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Serene architectural interior with natural organic morning shadows',
  },
  {
    id: 'img-06',
    profileId: 'image_generation',
    title: 'Astronaut in Alien Crystal Cavern',
    idea: 'Futuristic astronaut exploring alien crystal cavern with amber glow',
    difficulty: 'complex',
    expectedTopicKeywords: ['astronaut', 'crystals', 'cavern', 'amber', 'geological', 'spacesuit'],
    forbiddenTerms: ['```', 'SQL', 'TypeScript', 'endpoint'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Science fiction subterranean expedition with refractive mineral prism optics',
  },
  {
    id: 'img-07',
    profileId: 'image_generation',
    title: 'Vintage 1970s Muscle Car Coast',
    idea: 'Vintage 1970s film photo of a muscle car driving along California coastal highway',
    difficulty: 'medium',
    expectedTopicKeywords: ['1970s', 'muscle car', 'California', 'coastal', 'Kodak', 'film grain'],
    forbiddenTerms: ['npm install', 'function', 'class '],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Warm nostalgic 35mm film still with golden hour Pacific rim light',
  },
  {
    id: 'img-08',
    profileId: 'image_generation',
    title: 'Autumn Paris Cafe Watercolor',
    idea: 'Watercolor painting of a cozy cafe in Paris on an autumn afternoon',
    difficulty: 'simple',
    expectedTopicKeywords: ['watercolor', 'Paris', 'cafe', 'autumn', 'leaves', 'impasto'],
    forbiddenTerms: ['code', 'TypeScript', 'database'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Painterly loose watercolor wash with bleeding ochre and burnt sienna pigments',
  },
  {
    id: 'img-09',
    profileId: 'image_generation',
    title: 'Artisanal Ceramic Studio Photography',
    idea: 'Studio product photography of an artisanal ceramic coffee mug on black marble',
    difficulty: 'simple',
    expectedTopicKeywords: ['product photography', 'ceramic', 'mug', 'black marble', 'studio lighting', 'reflection'],
    forbiddenTerms: ['```', 'npm', 'API'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Commercial luxury editorial still life with dual softbox diffusion',
  },
  {
    id: 'img-10',
    profileId: 'image_generation',
    title: 'Brutalist Concrete Museum in Fog',
    idea: 'Architectural photography of a brutalist concrete museum in foggy morning',
    difficulty: 'medium',
    expectedTopicKeywords: ['brutalist', 'concrete', 'museum', 'fog', 'monolithic', 'architectural'],
    forbiddenTerms: ['TypeScript', 'component', 'function'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Atmospheric architectural study with geometric shadows and atmospheric haze',
  },
  {
    id: 'img-11',
    profileId: 'image_generation',
    title: 'Steampunk Airship in Storm Clouds',
    idea: 'Steampunk airship soaring through sunset storm clouds with brass propellers',
    difficulty: 'complex',
    expectedTopicKeywords: ['steampunk', 'airship', 'brass', 'clouds', 'storm', 'sunset', 'propellers'],
    forbiddenTerms: ['npm install', '```tsx', 'React'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Dynamic aerial steampunk leviathan cutting through turbulent cumulonimbus clouds',
  },
  {
    id: 'img-12',
    profileId: 'image_generation',
    title: 'Macro Honeybee on Lavender Dew',
    idea: 'Macro photograph of a honeybee pollinating a lavender flower with dew drops',
    difficulty: 'simple',
    expectedTopicKeywords: ['macro', 'honeybee', 'lavender', 'dew', 'pollen', 'shallow depth of field'],
    forbiddenTerms: ['```', 'TypeScript', 'backend'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'High-speed microscopic nature capture with translucent water droplets',
  },
  {
    id: 'img-13',
    profileId: 'image_generation',
    title: 'Dark Fantasy Sea Cliff Citadel',
    idea: 'Dark fantasy castle perched on jagged sea cliff with lightning storm',
    difficulty: 'medium',
    expectedTopicKeywords: ['dark fantasy', 'castle', 'cliff', 'lightning', 'waves', 'gothic'],
    forbiddenTerms: ['function()', 'Postgres', 'TypeScript'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Moody epic gothic landscape with turbulent ocean spray and lightning flash',
  },
  {
    id: 'img-14',
    profileId: 'image_generation',
    title: 'Flat Origami Fox Vector Logo',
    idea: 'Modern flat vector tech logo mark of an origami fox in emerald green',
    difficulty: 'simple',
    expectedTopicKeywords: ['vector', 'logo', 'origami', 'fox', 'emerald green', 'minimalist'],
    forbiddenTerms: ['npm run', 'database', 'class '],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Geometric brand identity mark on clean solid monochrome backdrop',
  },
  {
    id: 'img-15',
    profileId: 'image_generation',
    title: 'Cybernetic Detective Cinematic Portrait',
    idea: 'Cinematic portrait of a female cybernetic detective in trench coat with holographic HUD',
    difficulty: 'complex',
    expectedTopicKeywords: ['cybernetic', 'detective', 'trench coat', 'holographic', 'HUD', 'cinematic'],
    forbiddenTerms: ['```', 'TypeScript', 'API route'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Neo-noir character portrait with illuminated ocular implants and volumetric rain',
  },
  {
    id: 'img-16',
    profileId: 'image_generation',
    title: 'Double Exposure Wolf and Pine Ridge',
    idea: 'Double exposure portrait combining a wolf silhouette with pine forest mountains',
    difficulty: 'medium',
    expectedTopicKeywords: ['double exposure', 'wolf', 'silhouette', 'mountains', 'pine forest', 'surreal'],
    forbiddenTerms: ['code', 'npm', 'function'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Graphic fine-art double exposure blending wildlife and misty alpine peaks',
  },
  {
    id: 'img-17',
    profileId: 'image_generation',
    title: 'Antique Stained Glass Library',
    idea: 'Cozy bookshop interior with towering wooden shelves and stained glass window',
    difficulty: 'simple',
    expectedTopicKeywords: ['bookshop', 'shelves', 'stained glass', 'dust motes', 'warm lighting', 'wood'],
    forbiddenTerms: ['```typescript', 'interface ', 'React'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Warm golden interior with sunbeams cutting through colorful kaleidoscopic glass',
  },
  {
    id: 'img-18',
    profileId: 'image_generation',
    title: 'Mythological Golden Shrine Dragon',
    idea: 'Mythological golden dragon coiled around an ancient mountain shrine',
    difficulty: 'complex',
    expectedTopicKeywords: ['dragon', 'golden', 'shrine', 'ancient', 'mountain', 'clouds', 'scales'],
    forbiddenTerms: ['```', 'SQL', 'TypeScript'],
    requiredMarkers: ['Midjourney', '--ar ', 'FLUX', 'Lighting', 'Camera'],
    description: 'Epic mythological scale with ornate hand-chiseled stone and iridescent scales',
  },

  // -------------------------------------------------------------
  // 3. TECHNICAL & LONG-FORM WRITING (18 Test Ideas)
  // -------------------------------------------------------------
  {
    id: 'write-01',
    profileId: 'writing',
    title: 'Distributed Consensus Edge Computing Failures',
    idea: 'In-depth engineering essay on why distributed consensus protocols fail in edge computing',
    difficulty: 'complex',
    expectedTopicKeywords: ['consensus', 'edge', 'partition', 'latency', 'Raft', 'Paxos', 'FLP'],
    forbiddenTerms: ['In conclusion,', 'Needless to say', 'Certainly!', 'In this fast-paced world'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Rigorous architectural analysis of quorum requirements across erratic wireless links',
  },
  {
    id: 'write-02',
    profileId: 'writing',
    title: 'AI-Native Database Launch Announcement',
    idea: 'Compelling launch announcement post for an AI-native database query engine',
    difficulty: 'medium',
    expectedTopicKeywords: ['launch', 'database', 'engine', 'vector', 'latency', 'SQL', 'developer'],
    forbiddenTerms: ['Delve into', 'Tapestry', 'It goes without saying'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Key Takeaways'],
    description: 'High-energy developer-focused product launch post emphasizing tangible benchmarks',
  },
  {
    id: 'write-03',
    profileId: 'writing',
    title: 'JavaScript V8 Garbage Collection Teardown',
    idea: 'Technical teardown of memory management and garbage collection in modern JavaScript runtimes',
    difficulty: 'complex',
    expectedTopicKeywords: ['V8', 'garbage collection', 'memory', 'heap', 'scavenger', 'mark-sweep', 'allocation'],
    forbiddenTerms: ['In conclusion,', 'Certainly!', 'Sure, here is'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Deep runtime mechanics analyzing generational hypotheses and memory leaks',
  },
  {
    id: 'write-04',
    profileId: 'writing',
    title: 'Zero-Downtime Blue-Green Database Migrations',
    idea: 'Step-by-step developer tutorial on zero-downtime database migrations with blue-green deployments',
    difficulty: 'complex',
    expectedTopicKeywords: ['zero-downtime', 'migration', 'blue-green', 'backward compatible', 'dual-write', 'schema'],
    forbiddenTerms: ['In conclusion,', 'Needless to say'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Practical engineering runbook for non-destructive schema evolution',
  },
  {
    id: 'write-05',
    profileId: 'writing',
    title: 'Economic ROI of Serverless vs Cloud VMs',
    idea: 'Executive thought leadership article on the economic ROI of migrating from legacy clouds to serverless',
    difficulty: 'medium',
    expectedTopicKeywords: ['ROI', 'serverless', 'cost', 'idle', 'compute', 'total cost of ownership'],
    forbiddenTerms: ['Tapestry', 'In this fast-paced world'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Financial and architectural trade-off analysis comparing baseline vs spike loads',
  },
  {
    id: 'write-06',
    profileId: 'writing',
    title: 'Connection Pool Exhaustion Post-Mortem',
    idea: 'Comprehensive post-mortem report of a 4-hour production outage caused by connection pool exhaustion',
    difficulty: 'complex',
    expectedTopicKeywords: ['post-mortem', 'outage', 'connection pool', 'PostgreSQL', 'deadlock', 'remediation'],
    forbiddenTerms: ['In conclusion,', 'Delve into'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Key Takeaways'],
    description: 'Blameless engineering incident report with root-cause timeline and prevention fixes',
  },
  {
    id: 'write-07',
    profileId: 'writing',
    title: 'Event Sourcing vs REST State Mutation',
    idea: 'Architectural comparison: Event-driven event sourcing vs. traditional REST state mutation',
    difficulty: 'complex',
    expectedTopicKeywords: ['event sourcing', 'CQRS', 'REST', 'audit log', 'projection', 'rehydration'],
    forbiddenTerms: ['In conclusion,', 'It goes without saying'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Nuanced architectural guide exploring eventual consistency and operational complexity',
  },
  {
    id: 'write-08',
    profileId: 'writing',
    title: 'WebAuthn Passkeys Developer Guide',
    idea: "A developer's guide to building secure WebAuthn passkey authentication from scratch",
    difficulty: 'complex',
    expectedTopicKeywords: ['WebAuthn', 'passkey', 'cryptographic', 'FIDO2', 'challenge', 'authenticator'],
    forbiddenTerms: ['In this fast-paced world', 'Certainly!'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Security-first implementation guide breaking down challenge-response verification',
  },
  {
    id: 'write-09',
    profileId: 'writing',
    title: 'CLI Speed vs Bloated GUI Dashboards Manifesto',
    idea: 'Product manifesto on why simplicity and command-line speed beat bloated GUI dashboards',
    difficulty: 'medium',
    expectedTopicKeywords: ['CLI', 'speed', 'terminal', 'GUI', 'latency', 'workflow', 'developer experience'],
    forbiddenTerms: ['Tapestry', 'Needless to say'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Key Takeaways'],
    description: 'Opinionated developer tooling essay advocating keyboard-first productivity',
  },
  {
    id: 'write-10',
    profileId: 'writing',
    title: 'Vector Index Algorithms HNSW vs IVF-PQ',
    idea: 'Deep dive into vector database index algorithms: HNSW vs IVF-PQ trade-offs',
    difficulty: 'complex',
    expectedTopicKeywords: ['HNSW', 'IVF-PQ', 'vector', 'indexing', 'approximate nearest neighbor', 'recall', 'quantization'],
    forbiddenTerms: ['In conclusion,', 'Delve into'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Mathematical and systems analysis of high-dimensional vector search indices',
  },
  {
    id: 'write-11',
    profileId: 'writing',
    title: 'Autonomous Coding Agents & Junior Engineers',
    idea: 'Opinion piece on the rise of autonomous coding agents and the future of junior software engineers',
    difficulty: 'medium',
    expectedTopicKeywords: ['coding agents', 'software engineers', 'mentorship', 'code review', 'automation'],
    forbiddenTerms: ['In this fast-paced world', 'It goes without saying'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Key Takeaways'],
    description: 'Realistic perspective on changing engineering roles and apprentice-level skill formation',
  },
  {
    id: 'write-12',
    profileId: 'writing',
    title: 'Rate Limiting Algorithms Comparative Guide',
    idea: 'Comprehensive guide to rate limiting algorithms: Token bucket, Leaky bucket, and Sliding window',
    difficulty: 'complex',
    expectedTopicKeywords: ['rate limit', 'token bucket', 'leaky bucket', 'sliding window', 'Redis', 'burst'],
    forbiddenTerms: ['In conclusion,', 'Certainly!'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Mathematical derivation and distributed cache implications of rate limiting strategies',
  },
  {
    id: 'write-13',
    profileId: 'writing',
    title: 'Rust Instant Container Scanner Announcement',
    idea: 'Technical announcement of an open-source Rust CLI for instantaneous container scanning',
    difficulty: 'medium',
    expectedTopicKeywords: ['Rust', 'container', 'scanning', 'CLI', 'vulnerabilities', 'SBOM', 'CVE'],
    forbiddenTerms: ['Tapestry', 'Delve into'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Key Takeaways'],
    description: 'Announcing a high-speed static container vulnerability analysis tool',
  },
  {
    id: 'write-14',
    profileId: 'writing',
    title: 'Lowering Postgres Network Egress by 64%',
    idea: 'Case study: How optimizing Postgres egress lowered cloud infrastructure bills by 64%',
    difficulty: 'complex',
    expectedTopicKeywords: ['Postgres', 'egress', 'SELECT *', 'bandwidth', 'overfetching', 'indices'],
    forbiddenTerms: ['In conclusion,', 'In this fast-paced world'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Data-driven cost reduction teardown detailing selective queries and compression',
  },
  {
    id: 'write-15',
    profileId: 'writing',
    title: 'Critical Rendering Path & Core Web Vitals',
    idea: 'Deep dive into web performance: Critical rendering path and Core Web Vitals optimization',
    difficulty: 'complex',
    expectedTopicKeywords: ['Core Web Vitals', 'LCP', 'CLS', 'critical rendering path', 'DOM', 'hydration'],
    forbiddenTerms: ['Needless to say', 'Certainly!'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Sub-millisecond browser layout engine optimization for high-traffic web applications',
  },
  {
    id: 'write-16',
    profileId: 'writing',
    title: 'Defending Multi-Tenant LLM Apps Against Injection',
    idea: 'Security whitepaper: Defending against prompt injection in multi-tenant LLM applications',
    difficulty: 'complex',
    expectedTopicKeywords: ['prompt injection', 'jailbreak', 'multi-tenant', 'sanitization', 'LLM', 'boundaries'],
    forbiddenTerms: ['In conclusion,', 'Delve into'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'Defensive engineering doctrine separating untrusted user data from execution contexts',
  },
  {
    id: 'write-17',
    profileId: 'writing',
    title: 'Distributed Tracing with OpenTelemetry',
    idea: 'Architectural guide to implementing distributed tracing with OpenTelemetry and Jaeger',
    difficulty: 'complex',
    expectedTopicKeywords: ['distributed tracing', 'OpenTelemetry', 'Jaeger', 'span', 'context propagation', 'trace'],
    forbiddenTerms: ['In this fast-paced world', 'It goes without saying'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Trade-offs', '## Key Takeaways'],
    description: 'End-to-end tracing telemetry implementation across microservice RPC boundaries',
  },
  {
    id: 'write-18',
    profileId: 'writing',
    title: 'Bedrock 2.0 Workstation Release Announcement',
    idea: 'Product launch email newsletter announcing Bedrock 2.0 and new intelligent workstation features',
    difficulty: 'medium',
    expectedTopicKeywords: ['Bedrock', 'workstation', 'prompt', 'models', 'generation', 'workspace'],
    forbiddenTerms: ['Tapestry', 'Needless to say'],
    requiredMarkers: ['## The Core Problem', '## Architecture & Mechanics', '## Key Takeaways'],
    description: 'Crisp release newsletter highlighting tangible productivity wins for prompt engineers',
  },

  // -------------------------------------------------------------
  // 4. FREELANCE BRIEF & SOW (18 Test Ideas)
  // -------------------------------------------------------------
  {
    id: 'brief-01',
    profileId: 'freelance_brief',
    title: 'Shopify Plus Headless Coffee Store',
    idea: 'Complete redesign and Shopify Plus headless store build for an artisanal coffee roaster',
    difficulty: 'complex',
    expectedTopicKeywords: ['Shopify Plus', 'headless', 'coffee', 'Next.js', 'e-commerce', 'milestones'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD', 'Certainly!'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Production Scope of Work with explicit payment gates and acceptance criteria',
  },
  {
    id: 'brief-02',
    profileId: 'freelance_brief',
    title: 'Cross-Platform Fitness Tracking Mobile MVP',
    idea: 'Native iOS and Android mobile app MVP for personal fitness training tracking',
    difficulty: 'medium',
    expectedTopicKeywords: ['mobile app', 'fitness', 'workout', 'MVP', 'iOS', 'Android', 'milestones'],
    forbiddenTerms: ['etc.', 'whenever possible', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Defined scope for client build preventing continuous mobile feature creep',
  },
  {
    id: 'brief-03',
    profileId: 'freelance_brief',
    title: 'B2B SaaS Animated Marketing Website',
    idea: 'B2B SaaS marketing website overhaul with Framer animations, CMS blog, and lead capture',
    difficulty: 'medium',
    expectedTopicKeywords: ['marketing website', 'Framer', 'CMS', 'lead capture', 'animations', 'SEO'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Agency client deliverable contract with responsive browser testing sign-off',
  },
  {
    id: 'brief-04',
    profileId: 'freelance_brief',
    title: 'Legacy WordPress to Next.js Migration',
    idea: 'Full-stack migration of legacy WordPress portal to Next.js and Supabase',
    difficulty: 'complex',
    expectedTopicKeywords: ['WordPress', 'migration', 'Next.js', 'Supabase', 'content', 'redirects'],
    forbiddenTerms: ['etc.', 'TBD', 'Sure, here is'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'High-risk content and SEO migration contract protecting 301 URL equity',
  },
  {
    id: 'brief-05',
    profileId: 'freelance_brief',
    title: 'Boutique Real Estate Agency CRM',
    idea: 'Custom CRM dashboard for a boutique real estate agency with MLS property syncing',
    difficulty: 'complex',
    expectedTopicKeywords: ['CRM', 'real estate', 'MLS', 'listings', 'agents', 'sync', 'dashboard'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Brokerage client project detailing RETS/RESO MLS protocol boundaries',
  },
  {
    id: 'brief-06',
    profileId: 'freelance_brief',
    title: 'Stripe Subscription Billing Integration',
    idea: 'Stripe billing and subscription tier integration for an existing React web platform',
    difficulty: 'medium',
    expectedTopicKeywords: ['Stripe', 'subscription', 'billing', 'webhook', 'tier', 'customer portal'],
    forbiddenTerms: ['etc.', 'TBD', 'whenever possible'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Surgical financial integration SOW with strict test-suite sign-off requirements',
  },
  {
    id: 'brief-07',
    profileId: 'freelance_brief',
    title: 'Figma to React Tailwind Design System',
    idea: 'Design system and UI component library creation in Figma with Tailwind React code export',
    difficulty: 'medium',
    expectedTopicKeywords: ['design system', 'Figma', 'Tailwind', 'components', 'storybook', 'tokens'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Cross-functional design engineering deliverable with Storybook component audit',
  },
  {
    id: 'brief-08',
    profileId: 'freelance_brief',
    title: 'Automated Invoicing & QuickBooks Service',
    idea: 'Automated invoicing and QuickBooks sync backend service for a consulting firm',
    difficulty: 'medium',
    expectedTopicKeywords: ['invoicing', 'QuickBooks', 'accounting', 'sync', 'OAuth', 'ledger'],
    forbiddenTerms: ['etc.', 'TBD', 'Certainly!'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Financial accounting synchronization with idempotent retry guarantees',
  },
  {
    id: 'brief-09',
    profileId: 'freelance_brief',
    title: 'Internal Corporate Employee Onboarding',
    idea: 'Internal employee onboarding portal with video tutorials and progress tracking',
    difficulty: 'simple',
    expectedTopicKeywords: ['onboarding', 'employee', 'progress', 'video', 'dashboard', 'auth'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Human resources internal web application with role-based checklist completion',
  },
  {
    id: 'brief-10',
    profileId: 'freelance_brief',
    title: 'E-Commerce Core Web Vitals Remediation',
    idea: 'Search engine optimization and Core Web Vitals audit and remediation for an e-commerce brand',
    difficulty: 'medium',
    expectedTopicKeywords: ['audit', 'Core Web Vitals', 'remediation', 'LCP', 'speed', 'SEO', 'e-commerce'],
    forbiddenTerms: ['etc.', 'TBD', 'whenever possible'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Performance consulting SOW tied to specific Google PageSpeed metric benchmarks',
  },
  {
    id: 'brief-11',
    profileId: 'freelance_brief',
    title: 'Three.js 3D Luxury Watch Customizer',
    idea: 'Interactive 3D product customizer using Three.js for a luxury watch brand',
    difficulty: 'complex',
    expectedTopicKeywords: ['Three.js', '3D', 'customizer', 'watch', 'materials', 'WebGL', 'textures'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'High-end interactive WebGL configurator with asset loading constraints',
  },
  {
    id: 'brief-12',
    profileId: 'freelance_brief',
    title: 'HIPAA-Compliant Patient Intake Portal',
    idea: 'HIPAA-compliant patient intake form and appointment scheduling system',
    difficulty: 'complex',
    expectedTopicKeywords: ['HIPAA', 'patient', 'intake', 'scheduling', 'encryption', 'compliance', 'PHI'],
    forbiddenTerms: ['etc.', 'TBD', 'Sure, here is'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Healthcare compliance contract enforcing Business Associate Agreement (BAA) standards',
  },
  {
    id: 'brief-13',
    profileId: 'freelance_brief',
    title: 'Multi-Language Travel Guide Localization',
    idea: 'Multi-language localization and translation pipeline for a mobile travel guide',
    difficulty: 'medium',
    expectedTopicKeywords: ['localization', 'i18n', 'translation', 'travel', 'languages', 'keys'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Internationalization workflow with automated translation dictionary verification',
  },
  {
    id: 'brief-14',
    profileId: 'freelance_brief',
    title: 'BigQuery to Postgres ETL Migration',
    idea: 'Data pipeline ETL migrating customer analytics from BigQuery to Postgres',
    difficulty: 'complex',
    expectedTopicKeywords: ['BigQuery', 'Postgres', 'ETL', 'pipeline', 'analytics', 'data transformation'],
    forbiddenTerms: ['etc.', 'TBD', 'whenever possible'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Data engineering deliverables contract with schema reconciliation checklists',
  },
  {
    id: 'brief-15',
    profileId: 'freelance_brief',
    title: 'Municipal Portal WCAG 2.1 AA Compliance',
    idea: 'Accessibility (WCAG 2.1 AA) compliance overhaul for a municipal government portal',
    difficulty: 'medium',
    expectedTopicKeywords: ['WCAG', 'accessibility', 'screen reader', 'contrast', 'keyboard navigation', 'audit'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Public sector digital accessibility remediation with automated and manual testing criteria',
  },
  {
    id: 'brief-16',
    profileId: 'freelance_brief',
    title: 'Community Discord Token Gate Bot',
    idea: 'Custom Discord and Telegram bot for community token verification and engagement',
    difficulty: 'simple',
    expectedTopicKeywords: ['Discord', 'Telegram', 'bot', 'verification', 'community', 'webhook'],
    forbiddenTerms: ['etc.', 'TBD', 'Certainly!'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Bot automation SOW with uptime hosting handover boundaries',
  },
  {
    id: 'brief-17',
    profileId: 'freelance_brief',
    title: 'Enterprise Okta SAML Single Sign-On',
    idea: 'Single sign-on (SSO) SAML and Okta enterprise integration for SaaS app',
    difficulty: 'complex',
    expectedTopicKeywords: ['SSO', 'SAML', 'Okta', 'enterprise', 'identity provider', 'assertion'],
    forbiddenTerms: ['etc.', 'and so on', 'TBD'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Enterprise identity integration SOW with strict sandbox sign-off milestones',
  },
  {
    id: 'brief-18',
    profileId: 'freelance_brief',
    title: 'AWS Terraform Infrastructure Modernization',
    idea: 'White-glove cloud infrastructure terraform setup on AWS with auto-scaling ECS cluster',
    difficulty: 'complex',
    expectedTopicKeywords: ['Terraform', 'AWS', 'ECS', 'infrastructure', 'auto-scaling', 'VPC', 'DevOps'],
    forbiddenTerms: ['etc.', 'TBD', 'whenever possible'],
    requiredMarkers: ['## Project Scope & Objectives', '## Deliverables Table', '## Acceptance Criteria', '## Milestones & Timeline', '## Out-of-Scope Boundaries'],
    description: 'Cloud infrastructure as code (IaC) contract with failover and blast-radius safeguards',
  },

  // -------------------------------------------------------------
  // 5. HACKATHON PITCH & SPRINT (18 Test Ideas)
  // -------------------------------------------------------------
  {
    id: 'pitch-01',
    profileId: 'hackathon_pitch',
    title: 'SignFlow Real-Time Mobile Sign Translator',
    idea: 'AI-powered real-time sign language translator using mobile camera and lightweight neural net',
    difficulty: 'medium',
    expectedTopicKeywords: ['sign language', 'mobile camera', 'real-time', 'accessibility', 'demo', 'judges'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap', 'Certainly!'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'High-impact presentation focused on live stage translation demo and accessibility prize tracks',
  },
  {
    id: 'pitch-02',
    profileId: 'hackathon_pitch',
    title: 'GeoSpill Emergency Dispatch Voice AI',
    idea: 'Automated emergency dispatch coordinator using geospatial clustering and voice AI',
    difficulty: 'complex',
    expectedTopicKeywords: ['emergency', 'dispatch', 'geospatial', 'voice AI', 'first responders', 'demo'],
    forbiddenTerms: ['5 year projection', 'Eventually we will add'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Emergency response hackathon pitch highlighting latency savings when seconds count',
  },
  {
    id: 'pitch-03',
    profileId: 'hackathon_pitch',
    title: 'GreenTransit Commuter Carbon Rewards',
    idea: 'Gamified carbon footprint tracker that rewards public transit commuters with local discounts',
    difficulty: 'simple',
    expectedTopicKeywords: ['carbon footprint', 'public transit', 'rewards', 'gamified', 'commuters', 'local business'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Climate tech consumer pitch with intuitive QR scan transit verification',
  },
  {
    id: 'pitch-04',
    profileId: 'hackathon_pitch',
    title: 'MeshRelief Offline Disaster Supply Tracker',
    idea: 'Decentralized disaster relief supply tracker with offline mesh network sync',
    difficulty: 'complex',
    expectedTopicKeywords: ['disaster relief', 'mesh network', 'offline', 'supplies', 'triage', 'sync'],
    forbiddenTerms: ['5 year projection', 'Eventually we will add'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Hardware/software hybrid pitch designed for zero-connectivity hurricane scenarios',
  },
  {
    id: 'pitch-05',
    profileId: 'hackathon_pitch',
    title: 'GigSafe Instant Milestone Escrow',
    idea: 'Smart contract escrow for freelance gig workers with instant milestone verification',
    difficulty: 'medium',
    expectedTopicKeywords: ['escrow', 'freelance', 'milestone', 'gig workers', 'instant payout', 'dispute'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Fintech sponsor bounty target solving wage withholding for remote creators',
  },
  {
    id: 'pitch-06',
    profileId: 'hackathon_pitch',
    title: 'VocalCalm Acoustic Stress Journal',
    idea: 'Mental health journaling companion with vocal pitch stress analysis and soothing exercises',
    difficulty: 'medium',
    expectedTopicKeywords: ['mental health', 'voice analysis', 'journaling', 'stress', 'pitch', 'companion'],
    forbiddenTerms: ['5 year projection', 'Certainly!'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Empathetic consumer AI demo with audio waveform stress heatmaps',
  },
  {
    id: 'pitch-07',
    profileId: 'hackathon_pitch',
    title: 'ChemVR Hazardous Science Lab',
    idea: 'Interactive chemistry VR lab simulation allowing students to perform virtual experiments safely',
    difficulty: 'complex',
    expectedTopicKeywords: ['chemistry', 'VR', 'simulation', 'experiments', 'education', 'safety'],
    forbiddenTerms: ['5 year projection', 'Eventually we will add'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'EdTech pitch demonstrating explosive chemical reactions in zero-risk virtual reality',
  },
  {
    id: 'pitch-08',
    profileId: 'hackathon_pitch',
    title: 'ShelterBite Surplus Food Rescue',
    idea: 'Community food waste rescue platform connecting restaurants with local shelters before closing',
    difficulty: 'simple',
    expectedTopicKeywords: ['food waste', 'restaurants', 'shelters', 'surplus', 'rescue', 'logistics'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Social good prize winner pairing surplus restaurant kitchen prep with midnight shelters',
  },
  {
    id: 'pitch-09',
    profileId: 'hackathon_pitch',
    title: 'CommitAction Meeting PR Bot',
    idea: 'AI meeting copilot that automatically detects action items and generates pull requests',
    difficulty: 'complex',
    expectedTopicKeywords: ['meeting', 'action items', 'pull requests', 'GitHub', 'copilot', 'automation'],
    forbiddenTerms: ['5 year projection', 'Eventually we will add'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Developer productivity tool proving live transcription converted to a working GitHub PR',
  },
  {
    id: 'pitch-10',
    profileId: 'hackathon_pitch',
    title: 'StackFlow Animated Visual Flowcharts',
    idea: 'Visual debugging tool that turns stack traces into animated visual flowcharts',
    difficulty: 'medium',
    expectedTopicKeywords: ['debugging', 'stack trace', 'flowchart', 'visualization', 'developer tool'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Instant visual "Aha!" moment for judges debugging recursive function crashes',
  },
  {
    id: 'pitch-11',
    profileId: 'hackathon_pitch',
    title: 'PotholePatrol Accelerometer Hazard Map',
    idea: 'Crowdsourced pothole and road hazard mapper using smartphone accelerometer',
    difficulty: 'simple',
    expectedTopicKeywords: ['pothole', 'accelerometer', 'crowdsourced', 'road hazard', 'mapping', 'sensor'],
    forbiddenTerms: ['5 year projection', 'Certainly!'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Civic tech pitch turning delivery drivers into autonomous municipal road inspectors',
  },
  {
    id: 'pitch-12',
    profileId: 'hackathon_pitch',
    title: 'MicroCushion Spare Change Safety Net',
    idea: 'Personal financial safety net that micro-invests spare change and cushions against unexpected bills',
    difficulty: 'simple',
    expectedTopicKeywords: ['financial', 'micro-investing', 'spare change', 'safety net', 'emergency fund'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Financial inclusion pitch focusing on overdraft prevention for hourly workers',
  },
  {
    id: 'pitch-13',
    profileId: 'hackathon_pitch',
    title: 'VerifyLens Synthetic Media Fact Checker',
    idea: 'Real-time fact checker browser overlay that detects synthetic media and unsourced claims',
    difficulty: 'complex',
    expectedTopicKeywords: ['fact checker', 'synthetic media', 'deepfake', 'overlay', 'verification', 'citations'],
    forbiddenTerms: ['5 year projection', 'Eventually we will add'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Media literacy weapon against synthetic political disinformation campaigns',
  },
  {
    id: 'pitch-14',
    profileId: 'hackathon_pitch',
    title: 'PlainLease Legal Contract Simplifier',
    idea: 'Automated legal document simplifier translating dense leases into plain English checklists',
    difficulty: 'simple',
    expectedTopicKeywords: ['legal', 'lease', 'tenant', 'plain English', 'clauses', 'rights'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Consumer legal protection app highlighting illegal landlord security deposit clauses',
  },
  {
    id: 'pitch-15',
    profileId: 'hackathon_pitch',
    title: 'ToolShare Neighborhood QR Lockboxes',
    idea: 'Peer-to-peer neighborhood tool and equipment lending library with QR lockboxes',
    difficulty: 'simple',
    expectedTopicKeywords: ['peer-to-peer', 'tools', 'lending', 'neighborhood', 'lockbox', 'QR code'],
    forbiddenTerms: ['5 year projection', 'Certainly!'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Community circular economy platform making buying single-use drill sets obsolete',
  },
  {
    id: 'pitch-16',
    profileId: 'hackathon_pitch',
    title: 'MnemoCard Generative Spaced Repetition',
    idea: 'Adaptive educational flashcards using spaced repetition and generative mnemonics',
    difficulty: 'medium',
    expectedTopicKeywords: ['spaced repetition', 'flashcards', 'mnemonics', 'learning', 'retention', 'adaptive'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Medical student learning copilot generating funny personalized visual memory hooks',
  },
  {
    id: 'pitch-17',
    profileId: 'hackathon_pitch',
    title: 'PawTriage Computer Vision Animal Clinic',
    idea: 'AI-assisted triage for animal shelters prioritizing veterinary care based on symptom photo',
    difficulty: 'medium',
    expectedTopicKeywords: ['animal shelter', 'veterinary', 'triage', 'symptoms', 'urgency', 'rescue'],
    forbiddenTerms: ['5 year projection', 'Eventually we will add'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Veterinary care triage saving stray lives with automated urgency scoring',
  },
  {
    id: 'pitch-18',
    profileId: 'hackathon_pitch',
    title: 'CampusHitch Student Verified Rideshare',
    idea: 'Campus ride-sharing network exclusively for verified university students',
    difficulty: 'simple',
    expectedTopicKeywords: ['rideshare', 'campus', 'students', 'verified .edu', 'commute', 'safety'],
    forbiddenTerms: ['5 year projection', 'In our long term roadmap'],
    requiredMarkers: ['## 10-Second Hook', '## The 2-Minute Demo Script', '## P0 MVP Happy Path', '## Judging Rubric Optimization', '## Tech Stack & Sponsor Bounties'],
    description: 'Safe student transit network cutting campus parking congestion and rideshare costs',
  },

  // -------------------------------------------------------------
  // 6. NO-CODE APPLICATION (18 Test Ideas)
  // -------------------------------------------------------------
  {
    id: 'nocode-01',
    profileId: 'no_code',
    title: 'Airtable & Make WhatsApp Lead Qualification',
    idea: 'Automated lead intake and qualification system using Airtable, Make, and WhatsApp notifications',
    difficulty: 'medium',
    expectedTopicKeywords: ['Airtable', 'Make', 'WhatsApp', 'leads', 'qualification', 'automation'],
    forbiddenTerms: ['npm install', 'cargo build', 'docker-compose', 'Certainly!'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Visual no-code automation pipeline with structured table schema and webhook payloads',
  },
  {
    id: 'nocode-02',
    profileId: 'no_code',
    title: 'Bubble & DocuSign Client Onboarding',
    idea: 'Client onboarding and contract signing portal built with Bubble and DocuSign webhooks',
    difficulty: 'complex',
    expectedTopicKeywords: ['Bubble', 'DocuSign', 'onboarding', 'contract', 'portal', 'workflows'],
    forbiddenTerms: ['npm install', 'memory allocation', 'pointers'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Secure visual web app with dynamic PDF contract generation and signing triggers',
  },
  {
    id: 'nocode-03',
    profileId: 'no_code',
    title: 'Glide & Google Sheets Warehouse Inventory',
    idea: 'Internal inventory tracking app for warehouse staff using Glide and Google Sheets',
    difficulty: 'simple',
    expectedTopicKeywords: ['Glide', 'Google Sheets', 'inventory', 'warehouse', 'barcode', 'stock'],
    forbiddenTerms: ['npm install', 'docker-compose', 'C++'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Mobile-first warehouse app with instant barcode camera scanning and stock sync',
  },
  {
    id: 'nocode-04',
    profileId: 'no_code',
    title: 'Zendesk Routing & Slack Alerts Zapier Flow',
    idea: 'Customer support ticketing system with automatic Zendesk routing and Slack alerts via Zapier',
    difficulty: 'medium',
    expectedTopicKeywords: ['Zendesk', 'Zapier', 'Slack', 'support', 'tickets', 'routing'],
    forbiddenTerms: ['npm install', 'cargo build', 'assembly'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'SLA-driven customer support notification recipes with escalation paths',
  },
  {
    id: 'nocode-05',
    profileId: 'no_code',
    title: 'Webflow & Make Event Badge Generator',
    idea: 'Event registration and badge generator web app built on Webflow and Make',
    difficulty: 'medium',
    expectedTopicKeywords: ['Webflow', 'Make', 'event', 'registration', 'badge', 'QR code'],
    forbiddenTerms: ['npm install', 'malloc', 'pointers'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Conference attendee portal that emails printable personalized PDF badges on signup',
  },
  {
    id: 'nocode-06',
    profileId: 'no_code',
    title: 'Softr & Stripe Real Estate Directory',
    idea: 'Real estate listing directory with member subscriptions using Softr and Stripe',
    difficulty: 'medium',
    expectedTopicKeywords: ['Softr', 'Stripe', 'real estate', 'Airtable', 'listings', 'membership'],
    forbiddenTerms: ['npm install', 'docker', 'compilation'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Gated portal with paid investor access to off-market multifamily real estate deals',
  },
  {
    id: 'nocode-07',
    profileId: 'no_code',
    title: 'Notion & Make Multi-Channel Social Poster',
    idea: 'Automated social media scheduling and cross-posting workflow using Notion and Make',
    difficulty: 'simple',
    expectedTopicKeywords: ['Notion', 'Make', 'social media', 'scheduling', 'cross-posting', 'calendar'],
    forbiddenTerms: ['npm install', 'cargo build', 'gcc'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Editorial calendar table in Notion triggering scheduled posts to LinkedIn and Twitter',
  },
  {
    id: 'nocode-08',
    profileId: 'no_code',
    title: 'Google Calendar & Slack PTO Approvals',
    idea: 'Employee PTO request and approval workflow integrated with Google Calendar and Slack',
    difficulty: 'simple',
    expectedTopicKeywords: ['Google Calendar', 'Slack', 'PTO', 'approvals', 'employee', 'automation'],
    forbiddenTerms: ['npm install', 'pointers', 'memory'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Interactive Slack buttons for managers approving time-off, automatically booking team calendar',
  },
  {
    id: 'nocode-09',
    profileId: 'no_code',
    title: 'Airtable & Resend Client Feedback Digest',
    idea: 'B2B client feedback portal with automated weekly summary emails using Airtable and Resend',
    difficulty: 'simple',
    expectedTopicKeywords: ['Airtable', 'Resend', 'feedback', 'summary email', 'digest', 'client'],
    forbiddenTerms: ['npm install', 'docker-compose', 'Rust'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Weekly automated NPS digest summarizing customer feedback into executive email reports',
  },
  {
    id: 'nocode-10',
    profileId: 'no_code',
    title: 'Bubble Subscription Box Address Manager',
    idea: 'Subscription box management and address verification system built with Bubble',
    difficulty: 'complex',
    expectedTopicKeywords: ['Bubble', 'subscription box', 'shipping', 'address', 'customer portal'],
    forbiddenTerms: ['npm install', 'cargo build', 'C++'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'E-commerce subscription portal handling cutoff dates, address updates, and skip months',
  },
  {
    id: 'nocode-11',
    profileId: 'no_code',
    title: 'Webflow, Memberstack & Stripe Paid Job Board',
    idea: 'Community job board with paid employer postings using Webflow, Memberstack, and Stripe',
    difficulty: 'medium',
    expectedTopicKeywords: ['Webflow', 'Memberstack', 'Stripe', 'job board', 'employer', 'postings'],
    forbiddenTerms: ['npm install', 'memory management', 'pointers'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Monetized niche career portal with employer dashboard and automated expired post archival',
  },
  {
    id: 'nocode-12',
    profileId: 'no_code',
    title: 'Receipt OCR Expense Approval Pipeline',
    idea: 'Vendor expense approval pipeline with receipt OCR scanning using Make and Google Drive',
    difficulty: 'medium',
    expectedTopicKeywords: ['Make', 'Google Drive', 'expense', 'receipt', 'OCR', 'approvals'],
    forbiddenTerms: ['npm install', 'cargo build', 'assembly'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Automated receipt scanning pipeline pulling merchant, date, and tax totals into spreadsheets',
  },
  {
    id: 'nocode-13',
    profileId: 'no_code',
    title: 'Jotform & Zapier Contractor Quote Calculator',
    idea: 'Custom quote generator for construction contractors using Jotform and Zapier',
    difficulty: 'simple',
    expectedTopicKeywords: ['Jotform', 'Zapier', 'quote', 'contractor', 'calculator', 'PDF'],
    forbiddenTerms: ['npm install', 'docker', 'C++'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Field estimating form that computes square footage materials and emails instant signed estimates',
  },
  {
    id: 'nocode-14',
    profileId: 'no_code',
    title: 'Adalo Gym Workout & Class Booking App',
    idea: 'Gym member workout tracking and class booking app built with Adalo',
    difficulty: 'medium',
    expectedTopicKeywords: ['Adalo', 'gym', 'workout', 'booking', 'classes', 'mobile app'],
    forbiddenTerms: ['npm install', 'pointers', 'memory'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Native-feel fitness studio booking app with waitlists and trainer appointment slots',
  },
  {
    id: 'nocode-15',
    profileId: 'no_code',
    title: 'Jira & GitHub Bug Intake Synchronization',
    idea: 'Bug report collection form with automatic Jira ticket creation and GitHub issue sync',
    difficulty: 'medium',
    expectedTopicKeywords: ['Jira', 'GitHub', 'bug report', 'sync', 'automation', 'issue'],
    forbiddenTerms: ['npm install', 'cargo build', 'gcc'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Customer bug submission portal translating user complaints into formatted engineer triage tickets',
  },
  {
    id: 'nocode-16',
    profileId: 'no_code',
    title: 'Notion & Make Freelancer Invoicing Dashboard',
    idea: 'Freelancer time-tracking and invoice generation dashboard using Notion and Make',
    difficulty: 'simple',
    expectedTopicKeywords: ['Notion', 'Make', 'freelancer', 'time-tracking', 'invoice', 'hourly'],
    forbiddenTerms: ['npm install', 'docker-compose', 'pointers'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'One-click time logger that aggregates client billable hours into end-of-month PDF invoices',
  },
  {
    id: 'nocode-17',
    profileId: 'no_code',
    title: 'Airtable & Bannerbear Automated Certificates',
    idea: 'Student course progress tracker and automated certificate issuer with Airtable and Bannerbear',
    difficulty: 'simple',
    expectedTopicKeywords: ['Airtable', 'Bannerbear', 'certificates', 'student', 'course', 'graduation'],
    forbiddenTerms: ['npm install', 'cargo build', 'C++'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Course completion webhook generating high-res personalized graduation diplomas on demand',
  },
  {
    id: 'nocode-18',
    profileId: 'no_code',
    title: 'Webflow & Stripe Live Donation Drive Tracker',
    idea: 'Donation drive tracker with live thermometer progress widget using Webflow and Stripe',
    difficulty: 'simple',
    expectedTopicKeywords: ['Webflow', 'Stripe', 'donation', 'fundraising', 'progress', 'charity'],
    forbiddenTerms: ['npm install', 'memory management', 'malloc'],
    requiredMarkers: ['## Platform Selection & Architecture', '## Data Collections & Schema', '## Visual UI Screen Topology', '## Automation & Webhook Recipes', '## Security & Access Control'],
    description: 'Nonprofit fundraising landing page updating real-time goal metrics upon Stripe webhook receipts',
  },

  // -------------------------------------------------------------
  // 7. CINEMATIC AI VIDEO (18 Test Ideas)
  // -------------------------------------------------------------
  {
    id: 'vid-01',
    profileId: 'video_generation',
    title: 'Deep Ocean Abyssal Ruins Submersible',
    idea: 'Deep sea exploration submersible discovering ancient bioluminescent ruins at ocean floor',
    difficulty: 'complex',
    expectedTopicKeywords: ['submersible', 'ocean floor', 'bioluminescent', 'ruins', 'camera', 'Runway Gen-3'],
    forbiddenTerms: ['```typescript', 'npm run', 'PostgreSQL', 'React component'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Cinematic underwater exploration with headlights revealing ancient submerged architecture',
  },
  {
    id: 'vid-02',
    profileId: 'video_generation',
    title: 'Cyberpunk Hovercar Low-Altitude Chase',
    idea: 'High-speed cyberpunk hovercar chase through rain-slicked mega-city skyscrapers',
    difficulty: 'complex',
    expectedTopicKeywords: ['hovercar', 'chase', 'skyscrapers', 'rain', 'neon', 'camera', 'speed'],
    forbiddenTerms: ['```', 'const ', 'npm install', 'function '],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Fast-paced kinetic cinematic camera movement following two speeder vehicles through skyscrapers',
  },
  {
    id: 'vid-03',
    profileId: 'video_generation',
    title: 'Sprouting Seedling Timelapse Macro',
    idea: 'Microscopic timelapse of a sunflower seedling breaking through rich soil into morning sunlight',
    difficulty: 'simple',
    expectedTopicKeywords: ['timelapse', 'seedling', 'soil', 'sunlight', 'macro', 'growth', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'TypeScript', 'database', 'Certainly!'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Botanical nature timelapse with volumetric dawn light and unfurling cotyledons',
  },
  {
    id: 'vid-04',
    profileId: 'video_generation',
    title: 'Samurai Duel in Falling Cherry Blossoms',
    idea: 'Epic cinematic samurai duel at dusk amidst swirling pink cherry blossoms and wind',
    difficulty: 'medium',
    expectedTopicKeywords: ['samurai', 'duel', 'cherry blossoms', 'katana', 'wind', 'dusk', 'Runway Gen-3'],
    forbiddenTerms: ['```typescript', 'npm ', 'REST API'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Kurosawa-inspired atmospheric combat sequence with fluid cloth physics and falling petals',
  },
  {
    id: 'vid-05',
    profileId: 'video_generation',
    title: 'Astronaut Moonwalk on Volcanic Exoplanet',
    idea: 'Lone astronaut walking across a jagged obsidian desert on an exoplanet with two moons',
    difficulty: 'medium',
    expectedTopicKeywords: ['astronaut', 'exoplanet', 'moons', 'obsidian', 'horizon', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'TypeScript', 'component'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Desolate space exploration scene with low-gravity footsteps kicking up crystalline dust',
  },
  {
    id: 'vid-06',
    profileId: 'video_generation',
    title: 'Steampunk Train Crossing Mountain Trestle',
    idea: 'Heavy brass steam locomotive chugging across a towering wooden trestle bridge over a snowy ravine',
    difficulty: 'complex',
    expectedTopicKeywords: ['steam locomotive', 'bridge', 'trestle', 'snow', 'ravine', 'smoke', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'npm install', 'function()'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Grand panoramic drone reveal circling a roaring steam engine in a blizzard',
  },
  {
    id: 'vid-07',
    profileId: 'video_generation',
    title: 'Artisan Glassblowing Flame Manipulation',
    idea: 'Extreme macro close-up of a glassblower spinning glowing molten glass in open furnace flame',
    difficulty: 'medium',
    expectedTopicKeywords: ['glassblower', 'molten glass', 'flame', 'macro', 'glowing', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'TypeScript', 'backend'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Viscous fluid dynamics and fiery amber reflections in a traditional glass studio',
  },
  {
    id: 'vid-08',
    profileId: 'video_generation',
    title: 'Golden Eagle Soaring Over Glacial Fjords',
    idea: 'FPV eagle point-of-view flight swooping low over turquoise glacial fjords and pine valleys',
    difficulty: 'simple',
    expectedTopicKeywords: ['eagle', 'flight', 'fjords', 'glacial', 'mountains', 'swoop', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'npm run', 'SQL'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Breathtaking high-altitude kinetic flight path hugging sharp granite mountain walls',
  },
  {
    id: 'vid-09',
    profileId: 'video_generation',
    title: 'Espresso Extraction Creamy Flow',
    idea: 'Slow-motion macro shot of dark espresso pouring from a bottomless portafilter into a glass cup',
    difficulty: 'simple',
    expectedTopicKeywords: ['espresso', 'portafilter', 'slow-motion', 'macro', 'crema', 'Runway Gen-3'],
    forbiddenTerms: ['```typescript', 'const ', 'class '],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Commercial beverage cinematography highlighting rich golden crema viscosity',
  },
  {
    id: 'vid-10',
    profileId: 'video_generation',
    title: 'Ancient Pyramid Construction Solar Alignment',
    idea: 'Cinematic sunrise reveal over thousands of workers raising the capstone of the Great Pyramid',
    difficulty: 'complex',
    expectedTopicKeywords: ['pyramid', 'capstone', 'sunrise', 'desert', 'ancient', 'epic', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'TypeScript', 'API'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Historical cinematic crane shot aligning with blinding golden sun rays',
  },
  {
    id: 'vid-11',
    profileId: 'video_generation',
    title: 'Quantum Portal Awakening in Particle Lab',
    idea: 'Underground particle accelerator sparking a swirling iridescent quantum wormhole ring',
    difficulty: 'complex',
    expectedTopicKeywords: ['particle accelerator', 'portal', 'wormhole', 'iridescent', 'energy', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'npm install', 'React'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'High-energy physics anomaly with gravitational lensing and electromagnetic arcs',
  },
  {
    id: 'vid-12',
    profileId: 'video_generation',
    title: 'Monarch Butterfly Migration Forest Canopy',
    idea: 'Dense cloud of thousands of orange monarch butterflies taking flight together in Mexican fir forest',
    difficulty: 'medium',
    expectedTopicKeywords: ['butterflies', 'migration', 'flight', 'canopy', 'orange', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'TypeScript', 'database'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Swirling insect swarm choreography with soft dappled sunlight filtering through pine needles',
  },
  {
    id: 'vid-13',
    profileId: 'video_generation',
    title: 'Vintage Jazz Quartet in Smoky 1950s Club',
    idea: 'Slow dolly shot across a dimly lit smoky 1950s Harlem jazz basement club during a saxophone solo',
    difficulty: 'medium',
    expectedTopicKeywords: ['jazz', 'saxophone', 'smoky', '1950s', 'club', 'dolly', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'npm ', 'function'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Film noir atmosphere with brass reflections and cigarette haze drifting across spotlight beams',
  },
  {
    id: 'vid-14',
    profileId: 'video_generation',
    title: 'Deep Space Supernova Remnant Shockwave',
    idea: 'Astrophysical telescope simulation of a massive blue supergiant star collapsing and exploding into a nebula',
    difficulty: 'complex',
    expectedTopicKeywords: ['supernova', 'star', 'explosion', 'nebula', 'shockwave', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'TypeScript', 'component'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Cosmic scale light shockwave expanding across astronomical light-years',
  },
  {
    id: 'vid-15',
    profileId: 'video_generation',
    title: 'Chef Flipping Wok over High Gas Flame',
    idea: 'Intense slow-motion culinary shot of a street food chef tossing sizzling noodles over a jet burner',
    difficulty: 'simple',
    expectedTopicKeywords: ['chef', 'wok', 'flame', 'noodles', 'slow-motion', 'street food', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'npm install', 'database'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Dynamic food photography capturing explosive steam, burning oil sparks, and tossed ingredients',
  },
  {
    id: 'vid-16',
    profileId: 'video_generation',
    title: 'Arctic Icebreaker Cracking Frozen Sea',
    idea: 'Overhead drone shot looking straight down as a red nuclear icebreaker plows through thick polar sea ice',
    difficulty: 'medium',
    expectedTopicKeywords: ['icebreaker', 'polar', 'drone', 'sea ice', 'arctic', 'fracture', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'TypeScript', 'REST'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Geometric ice fractures spreading outward from reinforced hull into deep navy ocean water',
  },
  {
    id: 'vid-17',
    profileId: 'video_generation',
    title: 'Venetian Gondola Gliding Through Morning Fog',
    idea: 'Smooth tracking shot along a quiet narrow Venice canal as a gondola emerges from dense grey morning mist',
    difficulty: 'simple',
    expectedTopicKeywords: ['Venice', 'gondola', 'canal', 'morning mist', 'water', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'npm run', 'function()'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'Serene European atmosphere with ripples breaking still canal reflections of ancient palazzo facades',
  },
  {
    id: 'vid-18',
    profileId: 'video_generation',
    title: 'Mechanical Watch Tourbillon Heartbeat',
    idea: 'Microscopic 120fps high-speed capture of an intricate tourbillon balance spring oscillating in a Swiss luxury watch',
    difficulty: 'complex',
    expectedTopicKeywords: ['tourbillon', 'watch', 'balance spring', 'escapement', 'macro', 'Runway Gen-3'],
    forbiddenTerms: ['```', 'TypeScript', 'API'],
    requiredMarkers: ['Runway Gen-3', 'Camera Movement', 'Lighting', 'Timeline Storyboard'],
    description: 'High-precision micro-mechanical horology with ruby jewel bearings and oscillating spiral springs',
  },
];

/* =========================================================================
   AUTOMATED SCORING ENGINE
   ========================================================================= */

/**
 * Universal Conversational Fluff & Fillers that frontier prompt engines must NEVER emit
 */
const UNIVERSAL_FORBIDDEN_FLUFF = [
  'Certainly!',
  'Sure, here is',
  'Sure! Here is',
  'Sure thing!',
  'I hope this helps',
  'Hope this helps!',
  'As an AI language model',
  'As an AI,',
  'Here is the updated prompt',
  'Here is your prompt',
  'Here you go!',
  'Let me know if you need anything else',
  'Feel free to ask',
];

/**
 * Lazy Engineering Anti-Patterns that must NEVER appear in code specs
 */
const LAZY_CODE_ANTI_PATTERNS = [
  '// TODO',
  '/* TODO',
  '// implement later',
  '/* implement later */',
  '// add logic here',
  '/* add logic here */',
  '// add your code here',
  ': any',
  'type any',
  'as any',
];

/**
 * 1. Score Format (0 - 100)
 */
export function scoreFormat(
  output: string,
  profile: ReturnType<typeof getProfileById>,
  testCase: EvalTestCase
): FormatScoreResult {
  const issues: string[] = [];
  const text = output.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  let score = 100;

  // Title check (# Title)
  const hasTitle = text.startsWith('# ') || /^#[^#]/m.test(text);
  if (!hasTitle) {
    score -= 15;
    issues.push('Missing top-level Markdown document title (# [Title])');
  }

  // Required structural markers
  const requiredMarkers = [
    ...new Set([...profile.requiredStructuralMarkers, ...testCase.requiredMarkers]),
  ];
  const missingMarkers: string[] = [];

  for (const marker of requiredMarkers) {
    if (!text.includes(marker)) {
      missingMarkers.push(marker);
    }
  }

  if (missingMarkers.length > 0) {
    const penaltyPerMarker = Math.min(40, missingMarkers.length * 10);
    score -= penaltyPerMarker;
    issues.push(`Missing required structural sections: ${missingMarkers.join(', ')}`);
  }

  // Raw JSON leakage check
  const isRawJsonWrapped =
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('[') && text.endsWith(']')) ||
    text.startsWith('```json');
  if (isRawJsonWrapped) {
    score -= 20;
    issues.push('Leaked raw JSON syntax or outer JSON wrapper into publication document');
  }

  // Word count check
  const meetsWordCount = wordCount >= profile.minWordCount;
  if (!meetsWordCount) {
    const deficitRatio = Math.max(0, 1 - wordCount / profile.minWordCount);
    const deficitPenalty = Math.round(deficitRatio * 25);
    score -= deficitPenalty;
    issues.push(`Insufficient specification depth (${wordCount}/${profile.minWordCount} words)`);
  }

  // Ensure 0 <= score <= 100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues,
    details: {
      hasTitle,
      hasRequiredMarkers: missingMarkers.length === 0,
      hasValidStructure: issues.length === 0,
      noRawJsonLeak: !isRawJsonWrapped,
      meetsWordCount,
    },
  };
}

/**
 * 2. Score Topic & Domain Proportionality (0 - 100)
 */
export function scoreTopic(
  output: string,
  testCase: EvalTestCase
): TopicScoreResult {
  const textLower = output.toLowerCase();
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  const driftPenalties: string[] = [];

  // Expected domain keywords
  for (const kw of testCase.expectedTopicKeywords) {
    const kwLower = kw.toLowerCase();
    if (textLower.includes(kwLower)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  }

  const keywordCoverage =
    testCase.expectedTopicKeywords.length > 0
      ? (matchedKeywords.length / testCase.expectedTopicKeywords.length) * 100
      : 100;

  let score = Math.round(keywordCoverage);

  // Domain Drift Checks (Penalize hallucinating crypto, payments, or microservices when not requested)
  const isSimpleDomain = testCase.difficulty === 'simple';
  const hasUnwarrantedCrypto =
    (textLower.includes('blockchain') || textLower.includes('smart contract') || textLower.includes('solidity')) &&
    !testCase.expectedTopicKeywords.some((k) => /blockchain|smart contract|crypto/i.test(k));

  if (isSimpleDomain && hasUnwarrantedCrypto) {
    score -= 25;
    driftPenalties.push('Hallucinated out-of-domain cryptocurrency/blockchain logic');
  }

  const hasUnwarrantedEscrow =
    textLower.includes('escrow') &&
    !testCase.expectedTopicKeywords.some((k) => /escrow/i.test(k));

  if (isSimpleDomain && hasUnwarrantedEscrow) {
    score -= 20;
    driftPenalties.push('Hallucinated complex financial escrow for a lightweight project');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    keywordCoverage,
    matchedKeywords,
    missingKeywords,
    driftPenalties,
  };
}

/**
 * 3. Score Forbidden Terms (0 - 100)
 */
export function scoreForbidden(
  output: string,
  profile: ReturnType<typeof getProfileById>,
  testCase: EvalTestCase
): ForbiddenScoreResult {
  const violations: { term: string; count: number; context: string }[] = [];
  let score = 100;

  // Aggregate forbidden terms: profile terms + testCase terms + universal fluff + lazy code
  const allForbidden = Array.from(
    new Set([
      ...UNIVERSAL_FORBIDDEN_FLUFF,
      ...(profile.id === 'coding_agent' ? LAZY_CODE_ANTI_PATTERNS : []),
      ...profile.forbiddenTerms,
      ...testCase.forbiddenTerms,
    ])
  );

  for (const term of allForbidden) {
    const regex = new RegExp(escapeRegex(term), 'gi');
    let match: RegExpExecArray | null;
    let termCount = 0;
    let snippet = '';

    while ((match = regex.exec(output)) !== null) {
      termCount++;
      if (!snippet) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(output.length, match.index + term.length + 30);
        snippet = `...${output.slice(start, end).replace(/\n/g, ' ')}...`;
      }
      if (termCount >= 10) break; // Avoid infinite regex looping on malformed outputs
    }

    if (termCount > 0) {
      violations.push({
        term,
        count: termCount,
        context: snippet,
      });

      // 20 points penalty per unique forbidden term found
      score -= Math.min(30, termCount * 15);
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    violations,
  };
}

/**
 * Composite Score & Grade Calculation
 * Formula: 35% Format + 35% Topic + 30% Forbidden Terms
 */
export function calculateCompositeScore(
  formatScore: number,
  topicScore: number,
  forbiddenScore: number
): { composite: number; grade: ScoreGrade; passed: boolean } {
  const composite = Math.round(
    formatScore * 0.35 + topicScore * 0.35 + forbiddenScore * 0.3
  );

  let grade: ScoreGrade = 'F';
  if (composite >= 95) grade = 'S';
  else if (composite >= 85) grade = 'A';
  else if (composite >= 70) grade = 'B';
  else if (composite >= 50) grade = 'C';
  else grade = 'F';

  // Pass threshold: Composite >= 75 and Forbidden Score >= 80
  const passed = composite >= 75 && forbiddenScore >= 80;

  return { composite, grade, passed };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* =========================================================================
   MODEL RELIABILITY & DROPPING SYSTEM
   ========================================================================= */

const STORAGE_KEY_DROPPED_MODELS = 'bedrock_dropped_models';
const STORAGE_KEY_EVAL_RUNS = 'bedrock_eval_runs';

export function getStoredDroppedModels(): Record<string, string[]> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY_DROPPED_MODELS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function isModelDropped(profileId: string, modelId: string): boolean {
  const dropped = getStoredDroppedModels();
  return Boolean(dropped[profileId]?.includes(modelId));
}

export function dropModelForProfile(
  profileId: string,
  modelId: string,
  _reason = 'Unreliable evaluation benchmarks'
): void {
  try {
    if (typeof window === 'undefined') return;
    const dropped = getStoredDroppedModels();
    if (!dropped[profileId]) dropped[profileId] = [];
    if (!dropped[profileId].includes(modelId)) {
      dropped[profileId].push(modelId);
      localStorage.setItem(STORAGE_KEY_DROPPED_MODELS, JSON.stringify(dropped));
    }
  } catch (err) {
    console.error('Failed to drop model:', err);
  }
}

export function restoreModelForProfile(profileId: string, modelId: string): void {
  try {
    if (typeof window === 'undefined') return;
    const dropped = getStoredDroppedModels();
    if (dropped[profileId]) {
      dropped[profileId] = dropped[profileId].filter((id) => id !== modelId);
      localStorage.setItem(STORAGE_KEY_DROPPED_MODELS, JSON.stringify(dropped));
    }
  } catch (err) {
    console.error('Failed to restore model:', err);
  }
}

export function getHistoricalEvalRuns(): EvalSuiteResult[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY_EVAL_RUNS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEvalRun(run: EvalSuiteResult): void {
  try {
    if (typeof window === 'undefined') return;
    const history = getHistoricalEvalRuns();
    const updated = [run, ...history.slice(0, 19)]; // Keep last 20 runs
    localStorage.setItem(STORAGE_KEY_EVAL_RUNS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save eval run:', err);
  }
}

/* =========================================================================
   SIMULATOR & LIVE EVALUATION RUNNER
   ========================================================================= */

/**
 * Deterministic generation simulator that generates realistic outputs mirroring
 * live frontier LLM behaviors (including real strengths and characteristic failure modes).
 * This enables 100+ tests to be bench-marked instantaneously without draining API quotas.
 */
export function simulateModelOutput(
  testCase: EvalTestCase,
  modelId: string
): string {
  const profile = getProfileById(testCase.profileId);
  const lowerModel = modelId.toLowerCase();

  // Model personality flags
  const isWeakLegacyModel = lowerModel.includes('zephyr') || lowerModel.includes('llama-3-8b');

  // Failure Mode Simulation for weaker models:
  if (isWeakLegacyModel) {
    // Leaks conversational fluff and lazy comments
    return `Certainly! Here is your ${profile.name} specification:

# ${testCase.title}
This project is an application about ${testCase.expectedTopicKeywords.slice(0, 2).join(' and ')}.

## Directives
- Implement the basic logic.
- Connect to database.

// TODO: implement this logic later
type any = Object;

Hope this helps! Feel free to ask if you need anything else!`;
  }

  // Elite Frontier Models (Gemini 3.8 / Claude 3.5 / Llama 3.3)
  if (profile.id === 'coding_agent') {
    return `# ${testCase.title} - Autonomous Agent System Directive

<role>
Principal Software Engineer & Systems Architect.
Target runtime: Production Next.js 15 App Router, TypeScript 5.5 (Strict), PostgreSQL 16.
</role>

<directives>
1. Ground every output in the domain: ${testCase.expectedTopicKeywords.join(', ')}.
2. Maintain zero-downtime transactional integrity.
3. Handle failure modes, network disconnections, and optimistic rollbacks gracefully.
</directives>

<negative_constraints>
- NEVER use the 'any' type in TypeScript; use 'unknown' with type narrowing.
- NEVER leave lazy placeholders or '// TODO' comments.
- NEVER execute blocking synchronous I/O operations.
- NEVER swallow errors in silent empty catch blocks.
</negative_constraints>

<schema_contracts>
export interface ${testCase.title.replace(/[^a-zA-Z]/g, '')}Payload {
  id: string;
  topic: string;
  ${testCase.expectedTopicKeywords[0] || 'metadata'}: Record<string, unknown>;
  createdAt: string;
}
</schema_contracts>

<file_topology>
src/
├── core/
│   ├── engine.ts
│   └── handlers.ts
└── tests/
    └── suite.test.ts
</file_topology>

<verification_protocol>
Run the following terminal commands to verify:
1. Compilation: \`tsc --noEmit\` (Exit code 0)
2. Lint: \`npm run lint\` (0 errors)
3. Unit Tests: \`vitest run\` (100% passing suites)
</verification_protocol>`;
  }

  if (profile.id === 'image_generation') {
    return `# ${testCase.title} - Visual Master Directive

### Master Midjourney v6.1 Copy-Paste Prompt Block
\`/imagine prompt: ${testCase.idea}, ${testCase.expectedTopicKeywords.join(', ')}, photorealistic 8k, volumetric cinema lighting, cinematic 35mm optical lens, Hasselblad H6D-100c, Kodak CineStill 800T, fine detailed textures, intricate depth of field --ar 16:9 --style raw --v 6.1\`

### Master FLUX.1 / DALL-E 3 Natural Language Prompt
A cinematic wide photograph capturing ${testCase.idea}. The atmosphere is defined by ${testCase.expectedTopicKeywords.slice(0, 3).join(', ')}.

### Optical & Camera Specifications
- Lens: 35mm f/1.4 Anamorphic Cinema Prime
- Lighting: Volumetric atmospheric rim lighting with natural chiaroscuro contrast
- Color Palette: Rich natural film tones with deep obsidian blacks

### Negative Exclusions
ugly, deformed, blurry, cartoon, render, watermark, low quality, duplicate subjects`;
  }

  if (profile.id === 'writing') {
    return `# ${testCase.title}: Architectural Deep Dive

## The Core Problem
In modern systems engineering, handling ${testCase.expectedTopicKeywords.slice(0, 2).join(' and ')} introduces non-trivial architectural trade-offs. Most implementations fail when boundary conditions degrade.

## Architecture & Mechanics
To resolve this, we examine ${testCase.expectedTopicKeywords.join(', ')}. By structuring the pipeline with explicit failure domains and predictable queue latencies, we eliminate unexpected bottlenecks.

## Trade-offs
1. Throughput vs Consistency: Bounded latency guarantees require strict partitioning.
2. Operational Complexity: Distributed observability requires unified OpenTelemetry tracing spans.

## Key Takeaways
- Always isolate state transitions into deterministic pipelines.
- Verify production health via automated canary probes before rolling deployments.`;
  }

  if (profile.id === 'freelance_brief') {
    return `# Scope of Work: ${testCase.title}

## Project Scope & Objectives
The objective of this engagement is to deliver a production-grade system for ${testCase.idea}, specifically addressing ${testCase.expectedTopicKeywords.join(', ')}.

## Deliverables Table
| Milestone | Deliverable | Acceptance Criteria | Timeline |
|:---|:---|:---|:---|
| M1 | Architecture RFC | Approved schema & design tokens | Week 1 |
| M2 | Core Implementation | ${testCase.expectedTopicKeywords[0] || 'Core feature'} tested in staging | Week 3 |
| M3 | Production Handover | 100% CI pass rate & documentation | Week 4 |

## Acceptance Criteria
1. System passes all automated unit and integration tests with zero lint warnings.
2. Production deployment verified on staging environment with client sign-off.

## Milestones & Timeline
Total engagement duration is 4 weeks with weekly progress check-ins.

## Out-of-Scope Boundaries
- Legacy third-party API refactoring outside agreed specifications.
- Ongoing post-launch retainer support without separate SLA agreement.`;
  }

  if (profile.id === 'hackathon_pitch') {
    return `# ${testCase.title} - 24-Hour Hackathon Sprint Plan

## 10-Second Hook
"${testCase.idea}. Today, this requires hours of manual friction—our solution achieves it in milliseconds with zero setup."

## The 2-Minute Demo Script
[00:00 - 00:30] The Pain Point: Show the problem in real-time.
[00:30 - 01:15] The Live Demo: Trigger ${testCase.expectedTopicKeywords[0] || 'core action'}, demonstrating instantaneous real-world results.
[01:15 - 01:45] Under the Hood: Highlight our use of ${testCase.expectedTopicKeywords.slice(1, 4).join(', ')}.
[01:45 - 02:00] The Unfair Advantage & Closing Ask.

## P0 MVP Happy Path
- Core functional user flow for ${testCase.expectedTopicKeywords[0] || 'primary feature'}.
- Beautiful dark mode UI with instant tactile feedback.

## Judging Rubric Optimization
- Innovation (10/10): Novel application of frontier AI.
- Technical Execution (10/10): End-to-end working software with zero mocked data.

## Tech Stack & Sponsor Bounties
- Frontend: React 19 + Tailwind CSS
- Real-Time Backend: WebSocket & Serverless API`;
  }

  if (profile.id === 'no_code') {
    return `# ${testCase.title} - Visual Application Architecture

## Platform Selection & Architecture
- Core Database: Airtable / Google Sheets
- Visual Frontend: Webflow / Softr / Bubble
- Automation Engine: Make.com / Zapier

## Data Collections & Schema
Table: \`${testCase.title.replace(/[^a-zA-Z]/g, '')}\`
- Field 1: \`ID\` (Auto-number)
- Field 2: \`Title\` (Single-line text)
- Field 3: \`${testCase.expectedTopicKeywords[0] || 'Status'}\` (Single-select)
- Field 4: \`Payload\` (Long text / JSON)

## Visual UI Screen Topology
1. Intake Form: Clean mobile-friendly submission screen.
2. Admin Dashboard: Real-time table view with Kanban status columns.

## Automation & Webhook Recipes
- Trigger: New record created in Airtable.
- Action 1: Format data for ${testCase.expectedTopicKeywords.slice(0, 2).join(' and ')}.
- Action 2: Dispatch notification webhook.

## Security & Access Control
- Restrict editor permissions via role-based email domain matching.
- Encrypt API keys in Make.com encrypted connections manager.`;
  }

  // Default Cinematic AI Video
  return `# ${testCase.title} - Cinematic AI Video Blueprint

### Master Runway Gen-3 Prompt Block
\`[Cinematic 4K slow dolly-in, 24fps]: ${testCase.idea}. The scene is illuminated by ${testCase.expectedTopicKeywords.slice(0, 3).join(', ')}, natural volumetric lighting, photorealistic textures, smooth atmospheric camera motion.\`

### Camera Movement & Shot Choreography
- Movement: Continuous orbital Steadicam pan transitioning into slow push-in
- Speed: 1.0x temporal speed with subtle motion blur on kinetic movement

### Lighting & Atmospheric Texture
- Mood: High-contrast cinematic naturalism with atmospheric haze
- Color Grade: Cold cyan shadows balanced with warm amber practical highlights

### Timeline Storyboard
| Time | Shot Type | Camera Vector | Lighting | Action |
|:---|:---|:---|:---|:---|
| 00:00 - 00:02 | Wide Establishing | Slow descent | Dawn horizon | Scene reveal |
| 00:02 - 00:05 | Medium Hero | Orbit 45-deg | Rim light | Subject action |`;
}

/**
 * Runs evaluation for a single test case against a single model
 */
export async function runEvalSingle(
  testCase: EvalTestCase,
  modelId: string,
  options?: {
    useSimulator?: boolean;
    systemPrompt?: string;
  }
): Promise<EvalResult> {
  const startTime = Date.now();
  const profile = getProfileById(testCase.profileId);
  let output = '';

  if (options?.useSimulator) {
    // Artificial 50-150ms delay for smooth UI progress rendering
    await new Promise((r) => setTimeout(r, 60 + Math.random() * 80));
    output = simulateModelOutput(testCase, modelId);
  } else {
    try {
      const sysPrompt =
        options?.systemPrompt ||
        `You are Bedrock, the premier AI Architect. Synthesize a publication-grade ${profile.name} specification for the user's idea.`;
      output = await testPrompt(modelId, sysPrompt, testCase.idea);
    } catch (err: any) {
      output = `Error executing testPrompt: ${err?.message || 'Model API failure'}`;
    }
  }

  const durationMs = Date.now() - startTime;
  const format = scoreFormat(output, profile, testCase);
  const topic = scoreTopic(output, testCase);
  const forbidden = scoreForbidden(output, profile, testCase);
  const { composite, grade, passed } = calculateCompositeScore(
    format.score,
    topic.score,
    forbidden.score
  );

  const critique = passed
    ? `Passed with ${grade} rating. Output adheres strictly to format and domain boundaries.`
    : `Failed benchmark: ${[...format.issues, ...forbidden.violations.map((v) => `Forbidden: "${v.term}"`), ...topic.driftPenalties].join('; ')}`;

  return {
    testCaseId: testCase.id,
    profileId: testCase.profileId,
    modelId,
    timestamp: Date.now(),
    durationMs,
    output,
    format,
    topic,
    forbidden,
    compositeScore: composite,
    grade,
    passed,
    critique,
  };
}

/**
 * Runs an evaluation suite across selected profiles and models
 */
export async function runEvalSuite(
  options: {
    profiles?: UseCaseProfileId[];
    models: string[];
    useSimulator?: boolean;
    autoDropUnreliable?: boolean;
    onProgress?: (progress: {
      completed: number;
      total: number;
      currentTest: string;
      currentModel: string;
      latestResult?: EvalResult;
    }) => void;
  }
): Promise<EvalSuiteResult> {
  const targetProfiles = options.profiles && options.profiles.length > 0
    ? options.profiles
    : (['coding_agent', 'image_generation', 'writing', 'freelance_brief', 'hackathon_pitch', 'no_code', 'video_generation'] as UseCaseProfileId[]);

  const filteredTests = EVAL_TEST_CASES.filter((tc) =>
    targetProfiles.includes(tc.profileId)
  );

  const totalRuns = filteredTests.length * options.models.length;
  let completed = 0;
  const results: EvalResult[] = [];

  for (const modelId of options.models) {
    for (const testCase of filteredTests) {
      options.onProgress?.({
        completed,
        total: totalRuns,
        currentTest: testCase.title,
        currentModel: modelId,
      });

      const res = await runEvalSingle(testCase, modelId, {
        useSimulator: options.useSimulator,
      });

      results.push(res);
      completed++;

      options.onProgress?.({
        completed,
        total: totalRuns,
        currentTest: testCase.title,
        currentModel: modelId,
        latestResult: res,
      });
    }
  }

  // Calculate Reliability Matrix per (model × profile)
  const reliabilityMatrix: ModelReliabilityRecord[] = [];
  const droppedModels: { modelId: string; profileId: UseCaseProfileId; reason: string }[] = [];

  for (const modelId of options.models) {
    for (const profileId of targetProfiles) {
      const modelProfileRuns = results.filter(
        (r) => r.modelId === modelId && r.profileId === profileId
      );

      if (modelProfileRuns.length === 0) continue;

      const total = modelProfileRuns.length;
      const passed = modelProfileRuns.filter((r) => r.passed).length;
      const failed = total - passed;
      const passRate = Math.round((passed / total) * 100);

      const avgFormat = Math.round(
        modelProfileRuns.reduce((acc, r) => acc + r.format.score, 0) / total
      );
      const avgTopic = Math.round(
        modelProfileRuns.reduce((acc, r) => acc + r.topic.score, 0) / total
      );
      const avgForbidden = Math.round(
        modelProfileRuns.reduce((acc, r) => acc + r.forbidden.score, 0) / total
      );
      const avgComposite = Math.round(
        modelProfileRuns.reduce((acc, r) => acc + r.compositeScore, 0) / total
      );

      // Determine Reliability Status
      let status: ModelReliabilityStatus = 'RELIABLE';
      let isDropped = isModelDropped(profileId, modelId);
      let dropReason: string | undefined;

      if (passRate < 60 || avgComposite < 60) {
        status = 'DROPPED';
        dropReason = `Low composite score (${avgComposite}/100) and failing pass rate (${passRate}%)`;
      } else if (passRate < 75 || avgComposite < 75) {
        status = 'DEGRADED';
        dropReason = `Marginal performance (${passRate}% pass rate)`;
      }

      if (options.autoDropUnreliable && status === 'DROPPED') {
        dropModelForProfile(profileId, modelId, dropReason);
        isDropped = true;
      }

      if (isDropped || status === 'DROPPED') {
        droppedModels.push({
          modelId,
          profileId,
          reason: dropReason || 'Failing reliability threshold',
        });
      }

      reliabilityMatrix.push({
        modelId,
        profileId,
        totalRuns: total,
        passedRuns: passed,
        failedRuns: failed,
        passRate,
        avgFormatScore: avgFormat,
        avgTopicScore: avgTopic,
        avgForbiddenScore: avgForbidden,
        avgCompositeScore: avgComposite,
        status: isDropped ? 'DROPPED' : status,
        consecutiveFailures: failed,
        isDropped,
        dropReason,
        lastUpdated: Date.now(),
      });
    }
  }

  // Summary Metrics
  const passedTotal = results.filter((r) => r.passed).length;
  const suiteResult: EvalSuiteResult = {
    runId: `eval-${Date.now()}`,
    timestamp: Date.now(),
    promptVersionHash: `v${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    profilesTested: targetProfiles,
    modelsTested: options.models,
    totalTests: results.length,
    passedCount: passedTotal,
    failedCount: results.length - passedTotal,
    overallPassRate: Math.round((passedTotal / (results.length || 1)) * 100),
    avgFormatScore: Math.round(
      results.reduce((acc, r) => acc + r.format.score, 0) / (results.length || 1)
    ),
    avgTopicScore: Math.round(
      results.reduce((acc, r) => acc + r.topic.score, 0) / (results.length || 1)
    ),
    avgForbiddenScore: Math.round(
      results.reduce((acc, r) => acc + r.forbidden.score, 0) / (results.length || 1)
    ),
    avgCompositeScore: Math.round(
      results.reduce((acc, r) => acc + r.compositeScore, 0) / (results.length || 1)
    ),
    results,
    reliabilityMatrix,
    droppedModels,
  };

  saveEvalRun(suiteResult);
  return suiteResult;
}

/* =========================================================================
   MARKDOWN & JSON REPORT EXPORTERS
   ========================================================================= */

export function exportEvalReportAsMarkdown(suite: EvalSuiteResult): string {
  const dateStr = new Date(suite.timestamp).toUTCString();

  return `# Bedrock Automated Evaluation Benchmark Report
**Generated:** ${dateStr}
**Prompt Revision Hash:** \`${suite.promptVersionHash}\`
**Overall Pass Rate:** **${suite.overallPassRate}%** (${suite.passedCount}/${suite.totalTests} tests passed)

---

## 1. Executive Metric Summary
| Metric | Score / Value | Status |
|:---|:---|:---|
| **Average Composite Score** | **${suite.avgCompositeScore} / 100** | ${suite.avgCompositeScore >= 80 ? '🟢 Production Ready' : '🔴 Needs Tuning'} |
| **Format Compliance** | ${suite.avgFormatScore} / 100 | ${suite.avgFormatScore >= 80 ? '✅ High' : '⚠️ Deviations'} |
| **Topic Precision** | ${suite.avgTopicScore} / 100 | ${suite.avgTopicScore >= 80 ? '✅ Grounded' : '⚠️ Drift'} |
| **Forbidden Term Hygiene** | ${suite.avgForbiddenScore} / 100 | ${suite.avgForbiddenScore >= 90 ? '✅ Clean' : '⚠️ Violations'} |
| **Models Dropped / Unreliable** | ${suite.droppedModels.length} combinations | ${suite.droppedModels.length === 0 ? '✅ All Reliable' : '🚨 Action Required'} |

---

## 2. Model Reliability & Status Matrix
| Model | Profile | Total Runs | Pass Rate | Composite | Status |
|:---|:---|:---|:---|:---|:---|
${suite.reliabilityMatrix
  .map(
    (r) =>
      `| \`${r.modelId}\` | ${r.profileId} | ${r.totalRuns} | ${r.passRate}% | ${r.avgCompositeScore}/100 | ${
        r.status === 'RELIABLE'
          ? '🟢 **RELIABLE**'
          : r.status === 'DEGRADED'
          ? '🟡 **DEGRADED**'
          : '🔴 **DROPPED**'
      } |`
  )
  .join('\n')}

---

## 3. Unreliable Dropped Models
${
  suite.droppedModels.length === 0
    ? 'All models passed reliability benchmarks above 75%.'
    : suite.droppedModels
        .map(
          (d) =>
            `- ❌ **Model \`${d.modelId}\` dropped for profile \`${d.profileId}\`**: ${d.reason}`
        )
        .join('\n')
}

---

## 4. Test Case Breakdown
| Test Case | Profile | Model | Score | Grade | Result |
|:---|:---|:---|:---|:---|:---|
${suite.results
  .slice(0, 50)
  .map(
    (r) =>
      `| ${r.testCaseId} | ${r.profileId} | \`${r.modelId}\` | ${r.compositeScore}/100 | **${r.grade}** | ${
        r.passed ? '✅ PASS' : '❌ FAIL'
      } |`
  )
  .join('\n')}
${suite.results.length > 50 ? `\n*(Showing 50 of ${suite.results.length} total test results)*` : ''}
`;
}

export function exportEvalReportAsJson(suite: EvalSuiteResult): string {
  return JSON.stringify(suite, null, 2);
}
