/**
 * Copyright 2026 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file The Engineering Bookshelf catalog: 14 foundational books spanning computer systems,
 * backend architecture, infrastructure and operations, and modern AI engineering, arranged as a
 * 132-topic progression. Pure data and lookup helpers (server- and client-safe).
 */

import { buildHumanitiesBooks } from './humanities-books';

export const BOOK_TRACKS = [
  'Foundations',
  'Backend',
  'Infra & Ops',
  'AI',
  'Reasoning & Systems',
  'Mind & Society',
  'History & Economics',
  'Power & Institutions',
] as const;
export type DefaultBookTrack = (typeof BOOK_TRACKS)[number];
/** Open string so Sanity Studio books can introduce custom sections (e.g. Startups, Design). */
export type BookTrack = DefaultBookTrack | (string & {});

export const BOOK_CATEGORIES = ['All', ...BOOK_TRACKS] as const;
export type BookCategory = 'All' | BookTrack;

export const BOOK_STATUSES = ['completed', 'reading', 'queued'] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];
export type BookStatusFilter = 'all' | BookStatus;

export interface BookStatusMeta {
  readonly label: string;
  readonly description: string;
  readonly accentColor: string;
  readonly isRead: boolean;
}

export const BOOK_STATUS_META: Readonly<Record<BookStatus, BookStatusMeta>> = {
  completed: {
    label: 'Read',
    description: 'Finished books with distilled notes and key takeaways.',
    accentColor: 'var(--brand)',
    isRead: true,
  },
  reading: {
    label: 'Reading',
    description: 'Books currently on the desk and actively being annotated.',
    accentColor: 'var(--brand-ink)',
    isRead: false,
  },
  queued: {
    label: 'Unread',
    description: 'Queued on the reading list for upcoming deep dives.',
    accentColor: 'var(--hairline-strong)',
    isRead: false,
  },
};

export function normalizeBookStatus(raw?: string | null): BookStatus {
  const value = raw?.trim().toLowerCase();
  if (value === 'reading' || value === 'in-progress' || value === 'in_progress') {
    return 'reading';
  }
  if (
    value === 'queued' ||
    value === 'unread' ||
    value === 'to-read' ||
    value === 'to_read' ||
    value === 'planned'
  ) {
    return 'queued';
  }
  return 'completed';
}

export interface ShelfCollection {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly accentColor: string;
  readonly bookSlugs: readonly string[];
}

export const slugifyShelf = (title: string): string =>
  title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Strips hyphens and spaces from an ISBN, returning it if valid ISBN-10 or ISBN-13, else null. */
export function normalizeIsbn(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return cleaned.length === 10 || cleaned.length === 13 ? cleaned : null;
}

export interface IsbnRegistryLinks {
  readonly openLibrary: string;
  readonly worldCat: string;
  readonly isbnSearch: string;
}

/** Authoritative public bibliographic registry URLs for a published ISBN. */
export function getIsbnRegistryLinks(isbn?: string | null): IsbnRegistryLinks | null {
  const cleaned = normalizeIsbn(isbn);
  if (!cleaned) return null;
  return {
    openLibrary: `https://openlibrary.org/isbn/${cleaned}`,
    worldCat: `https://search.worldcat.org/isbn/${cleaned}`,
    isbnSearch: `https://isbnsearch.org/isbn/${cleaned}`,
  };
}

export interface BookTopic {
  readonly number: number;
  readonly title: string;
}

export interface BookSpineTheme {
  /** Publisher or accent band at the top of the spine holding the stage number. */
  readonly capBg: string;
  readonly capText: string;
  /** Main spine body fill, title color, and subtle author ink. */
  readonly bodyBg: string;
  readonly titleColor: string;
  readonly authorColor: string;
  /** Subtle sheen tint along the hinge and outer edge. */
  readonly borderTint: string;
}

/**
 * Curated Live Console archival book-binding themes built strictly from CSS palette tokens.
 * Keeps adjacent 3D spines tactile and distinct while letting real book covers provide the color.
 */
export const LIVE_CONSOLE_SPINE_THEMES: readonly [BookSpineTheme, ...BookSpineTheme[]] = [
  {
    capBg: 'var(--surface-3)',
    capText: 'var(--fg-muted)',
    bodyBg: 'var(--surface-1)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-faint)',
    borderTint: 'var(--hairline)',
  },
  {
    capBg: 'var(--brand-subtle)',
    capText: 'var(--brand-ink)',
    bodyBg: 'var(--surface-2)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-faint)',
    borderTint: 'var(--brand-edge)',
  },
  {
    capBg: 'var(--surface-2)',
    capText: 'var(--fg-faint)',
    bodyBg: 'var(--canvas)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-muted)',
    borderTint: 'var(--hairline-strong)',
  },
  {
    capBg: 'var(--brand-subtle)',
    capText: 'var(--fg)',
    bodyBg: 'var(--surface-1)',
    titleColor: 'var(--fg)',
    authorColor: 'var(--fg-muted)',
    borderTint: 'var(--hairline)',
  },
];

/** Deterministic Live Console spine binding theme for a zero-based book index. */
export function getLiveConsoleSpineTheme(index: number): BookSpineTheme {
  const len = LIVE_CONSOLE_SPINE_THEMES.length;
  return LIVE_CONSOLE_SPINE_THEMES[((index % len) + len) % len] ?? LIVE_CONSOLE_SPINE_THEMES[0];
}

export interface BookItem {
  readonly slug: string;
  readonly stage: number;
  readonly stageLabel: string;
  readonly title: string;
  readonly spineTitle: string;
  readonly authors: string;
  readonly spineAuthor: string;
  readonly publisher: string;
  readonly edition: string;
  readonly year: number;
  readonly isbn: string;
  readonly track: BookTrack;
  readonly status: BookStatus;
  readonly summary: string;
  readonly coverSrc: string;
  readonly url: string;
  readonly spine: BookSpineTheme;
  readonly topics: readonly BookTopic[];
}

const ENGINEERING_BOOKS: readonly [BookItem, ...BookItem[]] = [
  {
    slug: 'computer-systems',
    stage: 1,
    stageLabel: '01',
    title: "Computer Systems: A Programmer's Perspective",
    spineTitle: 'Computer Systems',
    authors: "Randal E. Bryant & David R. O'Hallaron",
    spineAuthor: 'BRYANT',
    publisher: 'Pearson',
    edition: '3rd Edition',
    year: 2015,
    isbn: '978-0-13-409266-9',
    track: 'Foundations',
    status: 'completed',
    summary:
      'How code actually executes on hardware: bits, assembly, processor pipelining, memory hierarchies, linking, and system-level I/O.',
    coverSrc: '/assets/bookshelf/computer-systems.webp',
    url: 'https://csapp.cs.cmu.edu/',
    spine: getLiveConsoleSpineTheme(0),
    topics: [
      { number: 1, title: 'Bits, integers & IEEE 754 floating point' },
      { number: 2, title: 'x86-64 machine representation & calling conventions' },
      { number: 3, title: 'Instruction pipelining & branch prediction' },
      { number: 4, title: 'Memory hierarchy, SRAM, DRAM & CPU caches' },
      { number: 5, title: 'Cache-friendly data layout & spatial locality' },
      { number: 6, title: 'Static & dynamic linking, ELF & symbol resolution' },
      { number: 7, title: 'Exceptional control flow, traps & signals' },
      { number: 8, title: 'Virtual memory, page tables & TLB mechanics' },
      { number: 9, title: 'Dynamic memory allocation & heap fragmentation' },
      { number: 10, title: 'System-level I/O, descriptors & sockets' },
    ],
  },
  {
    slug: 'operating-systems',
    stage: 2,
    stageLabel: '02',
    title: 'Operating Systems: Three Easy Pieces',
    spineTitle: 'Operating Systems',
    authors: 'Remzi H. Arpaci-Dusseau & Andrea C. Arpaci-Dusseau',
    spineAuthor: 'ARPACI',
    publisher: 'Arpaci-Dusseau Books',
    edition: 'Version 1.10',
    year: 2018,
    isbn: '978-1-98-508659-3',
    track: 'Foundations',
    status: 'completed',
    summary:
      'The three pillars of every modern OS kernel: virtualizing the CPU and memory, coordinating concurrency, and persisting state safely on disk.',
    coverSrc: '/assets/bookshelf/operating-systems.webp',
    url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/',
    spine: getLiveConsoleSpineTheme(1),
    topics: [
      { number: 11, title: 'Processes, fork/exec & limited direct execution' },
      { number: 12, title: 'CPU scheduling: MLFQ, lottery & CFS' },
      { number: 13, title: 'Address spaces, paging & multi-level page tables' },
      { number: 14, title: 'Swapping policies, clock algorithm & thrashing' },
      { number: 15, title: 'Threads, locks, futexes & spin-wait tradeoffs' },
      { number: 16, title: 'Condition variables, semaphores & deadlock avoidance' },
      { number: 17, title: 'Event-based concurrency & epoll / io_uring' },
      { number: 18, title: 'I/O devices, DMA, NVMe & SSD flash translation' },
      { number: 19, title: 'File systems, inodes, ext4 & log-structured storage' },
      { number: 20, title: 'Crash consistency: fsck, journaling & copy-on-write' },
    ],
  },
  {
    slug: 'computer-networking',
    stage: 3,
    stageLabel: '03',
    title: 'Computer Networking: A Top-Down Approach',
    spineTitle: 'Computer Networking',
    authors: 'James F. Kurose & Keith W. Ross',
    spineAuthor: 'KUROSE',
    publisher: 'Pearson',
    edition: '8th Edition',
    year: 2021,
    isbn: '978-0-13-668155-7',
    track: 'Foundations',
    status: 'completed',
    summary:
      'How packets cross the internet from application protocols down to the wire: HTTP/3, DNS, TCP congestion control, BGP routing, and TLS.',
    coverSrc: '/assets/bookshelf/computer-networking.webp',
    url: 'https://gaia.cs.umass.edu/kurose_ross/',
    spine: getLiveConsoleSpineTheme(2),
    topics: [
      { number: 21, title: 'Packet switching, latency budgets & throughput' },
      { number: 22, title: 'HTTP/1.1, HTTP/2 multiplexing & QUIC (HTTP/3)' },
      { number: 23, title: 'DNS resolution, caching, Anycast & CDNs' },
      { number: 24, title: 'UDP, TCP handshakes, flow control & sliding windows' },
      { number: 25, title: 'TCP congestion control: CUBIC & BBR' },
      { number: 26, title: 'IPv4/IPv6 addressing, CIDR, NAT & subnetting' },
      { number: 27, title: 'Intra-AS routing (OSPF) & inter-AS BGP peering' },
      { number: 28, title: 'ARP, Ethernet switching, VLANs & link-layer framing' },
      { number: 29, title: 'TLS 1.3 handshake, PKI & mutual authentication' },
      { number: 30, title: 'Reverse proxies, L4/L7 load balancing & packet capture' },
    ],
  },
  {
    slug: 'designing-data-intensive-applications',
    stage: 4,
    stageLabel: '04',
    title: 'Designing Data-Intensive Applications',
    spineTitle: 'Designing Data-Intensive Applications',
    authors: 'Martin Kleppmann',
    spineAuthor: 'KLEPPMANN',
    publisher: "O'Reilly Media",
    edition: '2nd Edition',
    year: 2025,
    isbn: '978-1-44-937332-0',
    track: 'Backend',
    status: 'completed',
    summary:
      'The blueprint for reliable, scalable, and maintainable data systems: storage engines, replication, partitioning, transactions, consensus, and streams.',
    coverSrc: '/assets/bookshelf/designing-data-intensive-applications.webp',
    url: 'https://dataintensive.net/',
    spine: getLiveConsoleSpineTheme(3),
    topics: [
      { number: 31, title: 'Reliability, scalability & tail-latency percentiles' },
      { number: 32, title: 'Data models: relational, document & graph tradeoffs' },
      { number: 33, title: 'LSM-trees, SSTables, WAL & compaction strategies' },
      { number: 34, title: 'B-trees, column-oriented storage & OLAP engines' },
      { number: 35, title: 'Schema evolution: Protobuf, Avro & Thrift encoding' },
      { number: 36, title: 'Single-leader, multi-leader & leaderless replication' },
      { number: 37, title: 'Partitioning, consistent hashing & hot-key mitigation' },
      { number: 38, title: 'Isolation levels: read committed, snapshot & SSI' },
      { number: 39, title: 'Distributed clocks, fencing tokens & partial failures' },
      { number: 40, title: 'Linearizability, Raft/Paxos consensus & 2PC' },
      { number: 41, title: 'Event logs, CDC & stream-table duality' },
      { number: 42, title: 'End-to-end correctness, idempotency & auditing' },
    ],
  },
  {
    slug: 'system-design-interview',
    stage: 5,
    stageLabel: '05',
    title: "System Design Interview: An Insider's Guide",
    spineTitle: 'System Design Interview',
    authors: 'Alex Xu',
    spineAuthor: 'ALEX XU',
    publisher: 'ByteByteGo',
    edition: 'Volume 1',
    year: 2020,
    isbn: '979-8-66-465340-3',
    track: 'Backend',
    status: 'completed',
    summary:
      'Practical architecture patterns from zero to millions of users: rate limiters, consistent hashing, key-value stores, feeds, and real-time messaging.',
    coverSrc: '/assets/bookshelf/system-design-interview.webp',
    url: 'https://bytebytego.com/',
    spine: getLiveConsoleSpineTheme(4),
    topics: [
      { number: 43, title: 'Back-of-the-envelope capacity & QPS estimation' },
      { number: 44, title: 'Rate limiters: token bucket, sliding window & Redis' },
      { number: 45, title: 'Consistent hashing with virtual nodes' },
      { number: 46, title: 'Distributed key-value store & quorum tuning' },
      { number: 47, title: 'Snowflake distributed unique ID generation' },
      { number: 48, title: 'URL shorteners, base62 encoding & edge redirects' },
      { number: 49, title: 'Web crawlers, politeness queues & deduplication' },
      { number: 50, title: 'Notification fanout & delivery retry pipelines' },
      { number: 51, title: 'News feed fanout-on-write vs fanout-on-read' },
      { number: 52, title: 'Real-time chat, WebSockets & presence heartbeats' },
    ],
  },
  {
    slug: 'building-microservices',
    stage: 6,
    stageLabel: '06',
    title: 'Building Microservices: Designing Fine-Grained Systems',
    spineTitle: 'Building Microservices',
    authors: 'Sam Newman',
    spineAuthor: 'NEWMAN',
    publisher: "O'Reilly Media",
    edition: '2nd Edition',
    year: 2021,
    isbn: '978-1-49-203402-5',
    track: 'Backend',
    status: 'completed',
    summary:
      'Modeling service boundaries around domain context, evolving monoliths safely, choosing sync vs async communication, and isolating failures.',
    coverSrc: '/assets/bookshelf/building-microservices.webp',
    url: 'https://samnewman.io/books/building_microservices_2nd_edition/',
    spine: getLiveConsoleSpineTheme(5),
    topics: [
      { number: 53, title: 'Bounded contexts, high cohesion & loose coupling' },
      { number: 54, title: 'Strangler fig pattern & monolith decomposition' },
      { number: 55, title: 'Database-per-service & shared-data anti-patterns' },
      { number: 56, title: 'REST, gRPC, GraphQL & event-driven contracts' },
      { number: 57, title: 'Orchestration vs choreography & saga workflows' },
      { number: 58, title: 'Contract testing & backward-compatible deployments' },
      { number: 59, title: 'Timeouts, retries with jitter, bulkheads & breakers' },
      { number: 60, title: 'Zero-trust service identity, mTLS & API gateways' },
      { number: 61, title: 'Correlation IDs, distributed tracing & log context' },
      { number: 62, title: 'Team topologies & Conway-aligned ownership' },
    ],
  },
  {
    slug: 'docker-deep-dive',
    stage: 7,
    stageLabel: '07',
    title: 'Docker Deep Dive',
    spineTitle: 'Docker Deep Dive',
    authors: 'Nigel Poulton',
    spineAuthor: 'POULTON',
    publisher: 'Nigel Poulton',
    edition: '2024 Edition',
    year: 2024,
    isbn: '978-1-91-658525-6',
    track: 'Infra & Ops',
    status: 'completed',
    summary:
      'Containers from the Linux kernel up: namespaces, cgroups, OCI image layers, multi-stage builds, container networking, and supply-chain security.',
    coverSrc: '/assets/bookshelf/docker-deep-dive.webp',
    url: 'https://nigelpoulton.com/',
    spine: getLiveConsoleSpineTheme(6),
    topics: [
      { number: 63, title: 'Linux namespaces, cgroups v2 & capability dropping' },
      { number: 64, title: 'OCI runtime spec, containerd & runc lifecycle' },
      { number: 65, title: 'Union filesystems, OverlayFS & layer caching' },
      { number: 66, title: 'Multi-stage Dockerfiles, BuildKit & distroless images' },
      { number: 67, title: 'Bridge, host & overlay container networking' },
      { number: 68, title: 'Bind mounts, named volumes & stateless design' },
      { number: 69, title: 'Compose workflows, healthchecks & local parity' },
      { number: 70, title: 'Image signing, SBOMs, seccomp & non-root hardening' },
    ],
  },
  {
    slug: 'kubernetes-up-and-running',
    stage: 8,
    stageLabel: '08',
    title: 'Kubernetes: Up & Running',
    spineTitle: 'Kubernetes: Up & Running',
    authors: 'Brendan Burns, Joe Beda, Kelsey Hightower & Lachlan Evenson',
    spineAuthor: 'BURNS',
    publisher: "O'Reilly Media",
    edition: '3rd Edition',
    year: 2022,
    isbn: '978-1-09-811020-8',
    track: 'Infra & Ops',
    status: 'completed',
    summary:
      'Declarative container orchestration at scale: reconciliation loops, pods, services, ingress, autoscaling, stateful workloads, and operators.',
    coverSrc: '/assets/bookshelf/kubernetes-up-and-running.webp',
    url: 'https://www.oreilly.com/library/view/kubernetes-up-and/9781098110192/',
    spine: getLiveConsoleSpineTheme(7),
    topics: [
      { number: 71, title: 'Control plane: API server, etcd, scheduler & kubelet' },
      { number: 72, title: 'Declarative state & controller reconciliation loops' },
      { number: 73, title: 'Pods, sidecars, probes & graceful termination' },
      { number: 74, title: 'Deployments, rolling updates & PodDisruptionBudgets' },
      { number: 75, title: 'Services, kube-proxy, CoreDNS & Gateway API' },
      { number: 76, title: 'ConfigMaps, Secrets & external secret managers' },
      { number: 77, title: 'StatefulSets, PVCs & storage classes' },
      { number: 78, title: 'Requests, limits, QoS classes & HPA/VPA autoscaling' },
      { number: 79, title: 'RBAC, NetworkPolicies & pod security admission' },
      { number: 80, title: 'Custom Resource Definitions & the Operator pattern' },
    ],
  },
  {
    slug: 'terraform-up-and-running',
    stage: 9,
    stageLabel: '09',
    title: 'Terraform: Up & Running',
    spineTitle: 'Terraform: Up & Running',
    authors: 'Yevgeniy Brikman',
    spineAuthor: 'BRIKMAN',
    publisher: "O'Reilly Media",
    edition: '3rd Edition',
    year: 2022,
    isbn: '978-1-09-811674-3',
    track: 'Infra & Ops',
    status: 'completed',
    summary:
      'Writing production infrastructure as code: remote state locking, composable modules, zero-downtime rollouts, drift detection, and CI pipelines.',
    coverSrc: '/assets/bookshelf/terraform-up-and-running.webp',
    url: 'https://www.terraformupandrunning.com/',
    spine: getLiveConsoleSpineTheme(8),
    topics: [
      { number: 81, title: 'Declarative IaC & immutable infrastructure mindset' },
      { number: 82, title: 'Dependency graphs, plans & safe apply workflows' },
      { number: 83, title: 'Remote state storage, encryption & locking' },
      { number: 84, title: 'Environment isolation: workspaces vs directory layout' },
      { number: 85, title: 'Versioned reusable modules & clean input contracts' },
      { number: 86, title: 'Zero-downtime blue/green & create_before_destroy' },
      { number: 87, title: 'Secrets handling, OIDC workload identity & least privilege' },
      { number: 88, title: 'Automated IaC testing, policy-as-code & drift checks' },
    ],
  },
  {
    slug: 'site-reliability-engineering',
    stage: 10,
    stageLabel: '10',
    title: 'Site Reliability Engineering: How Google Runs Production Systems',
    spineTitle: 'Site Reliability Engineering',
    authors: 'Betsy Beyer, Chris Jones, Jennifer Petoff & Niall Richard Murphy',
    spineAuthor: 'GOOGLE SRE',
    publisher: "O'Reilly Media",
    edition: '1st Edition',
    year: 2016,
    isbn: '978-1-49-192912-4',
    track: 'Infra & Ops',
    status: 'completed',
    summary:
      'Treating operations as a software engineering problem: SLIs, SLOs, error budgets, toil elimination, alerting hygiene, and blameless postmortems.',
    coverSrc: '/assets/bookshelf/site-reliability-engineering.webp',
    url: 'https://sre.google/sre-book/table-of-contents/',
    spine: getLiveConsoleSpineTheme(9),
    topics: [
      { number: 89, title: 'Embracing risk: SLIs, SLOs & error budgets' },
      { number: 90, title: 'Eliminating toil through engineering automation' },
      { number: 91, title: 'The four golden signals: latency, traffic, errors, saturation' },
      { number: 92, title: 'Symptom-based alerting & multi-window burn rates' },
      { number: 93, title: 'Incident command, runbooks & sustainable on-call' },
      { number: 94, title: 'Blameless postmortems & corrective action tracking' },
      { number: 95, title: 'Load shedding, graceful degradation & retry budgets' },
      { number: 96, title: 'Preventing cascading failures & thundering herds' },
      { number: 97, title: 'Progressive rollouts, canaries & fast rollbacks' },
      { number: 98, title: 'Capacity planning, load testing & chaos game days' },
    ],
  },
  {
    slug: 'deep-learning',
    stage: 11,
    stageLabel: '11',
    title: 'Deep Learning',
    spineTitle: 'Deep Learning',
    authors: 'Ian Goodfellow, Yoshua Bengio & Aaron Courville',
    spineAuthor: 'GOODFELLOW',
    publisher: 'MIT Press',
    edition: 'Adaptive Computation',
    year: 2016,
    isbn: '978-0-26-203561-3',
    track: 'AI',
    status: 'completed',
    summary:
      'The mathematical foundation of neural networks: linear algebra, probability, backprop, optimization, regularization, sequence modeling, and generative models.',
    coverSrc: '/assets/bookshelf/deep-learning.webp',
    url: 'https://www.deeplearningbook.org/',
    spine: getLiveConsoleSpineTheme(10),
    topics: [
      { number: 99, title: 'Linear algebra, SVD, probability & information theory' },
      { number: 100, title: 'Feedforward networks, activations & universal approximation' },
      { number: 101, title: 'Automatic differentiation & backpropagation dynamics' },
      { number: 102, title: 'Regularization: weight decay, dropout & early stopping' },
      { number: 103, title: 'Optimization: SGD, momentum, Adam & learning schedules' },
      { number: 104, title: 'Convolutional architectures & inductive biases' },
      { number: 105, title: 'Sequence modeling, vanishing gradients & attention roots' },
      { number: 106, title: 'Representation learning, autoencoders & latent spaces' },
    ],
  },
  {
    slug: 'designing-machine-learning-systems',
    stage: 12,
    stageLabel: '12',
    title: 'Designing Machine Learning Systems',
    spineTitle: 'Designing Machine Learning Systems',
    authors: 'Chip Huyen',
    spineAuthor: 'HUYEN',
    publisher: "O'Reilly Media",
    edition: '1st Edition',
    year: 2022,
    isbn: '978-1-09-810796-3',
    track: 'AI',
    status: 'completed',
    summary:
      'End-to-end production ML engineering: data pipelines, feature engineering, offline vs online evaluation, distribution shift, and continual learning.',
    coverSrc: '/assets/bookshelf/designing-machine-learning-systems.webp',
    url: 'https://www.oreilly.com/library/view/designing-machine-learning/9781098107956/',
    spine: getLiveConsoleSpineTheme(11),
    topics: [
      { number: 107, title: 'Framing ML problems & business-aligned objectives' },
      { number: 108, title: 'Sampling, labeling pipelines & class imbalance' },
      { number: 109, title: 'Feature engineering, leakage prevention & feature stores' },
      { number: 110, title: 'Model selection, error analysis & experiment tracking' },
      { number: 111, title: 'Batch vs online serving, shadow deploys & A/B tests' },
      { number: 112, title: 'Data drift, concept shift & continual retraining' },
    ],
  },
  {
    slug: 'build-a-large-language-model',
    stage: 13,
    stageLabel: '13',
    title: 'Build a Large Language Model (From Scratch)',
    spineTitle: 'Build a Large Language Model',
    authors: 'Sebastian Raschka',
    spineAuthor: 'RASCHKA',
    publisher: 'Manning',
    edition: '1st Edition',
    year: 2024,
    isbn: '978-1-63-343716-6',
    track: 'AI',
    status: 'completed',
    summary:
      'Demystifying modern LLMs line by line in PyTorch: BPE tokenization, causal self-attention, GPT blocks, pretraining loops, and instruction tuning.',
    coverSrc: '/assets/bookshelf/build-a-large-language-model.webp',
    url: 'https://www.manning.com/books/build-a-large-language-model-from-scratch',
    spine: getLiveConsoleSpineTheme(12),
    topics: [
      { number: 113, title: 'Byte-pair encoding (BPE) tokenization & embeddings' },
      { number: 114, title: 'Scaled dot-product & causal multi-head self-attention' },
      { number: 115, title: 'Transformer blocks: LayerNorm, GELU & residual streams' },
      { number: 116, title: 'Autoregressive pretraining, cross-entropy & weight loading' },
      { number: 117, title: 'Supervised fine-tuning for classification & instructions' },
      { number: 118, title: 'Preference alignment (DPO/RLHF) & LoRA adapters' },
    ],
  },
  {
    slug: 'ai-engineering',
    stage: 14,
    stageLabel: '14',
    title: 'AI Engineering: Building Applications with Foundation Models',
    spineTitle: 'AI Engineering',
    authors: 'Chip Huyen',
    spineAuthor: 'HUYEN',
    publisher: "O'Reilly Media",
    edition: '1st Edition',
    year: 2025,
    isbn: '978-1-09-816630-4',
    track: 'AI',
    status: 'completed',
    summary:
      'Shipping on top of foundation models: evaluation, prompting, RAG, agents, finetuning, inference.',
    coverSrc: '/assets/bookshelf/ai-engineering.webp',
    url: 'https://www.oreilly.com/library/view/ai-engineering/9781098166298/',
    spine: getLiveConsoleSpineTheme(13),
    topics: [
      { number: 119, title: 'Foundation models: data, modeling, size' },
      { number: 120, title: 'Sampling strategies' },
      { number: 121, title: 'Evaluation & AI as a judge' },
      { number: 122, title: 'Prompt engineering' },
      { number: 123, title: 'Prompt injection & defenses' },
      { number: 124, title: 'RAG & retrieval optimization' },
      { number: 125, title: 'Embeddings & vector search' },
      { number: 126, title: 'Agents: tools & planning' },
      { number: 127, title: 'Memory' },
      { number: 128, title: 'Parameter-efficient finetuning' },
      { number: 129, title: 'Dataset engineering & synthesis' },
      { number: 130, title: 'Inference optimization' },
      { number: 131, title: 'Guardrails, model router & gateway' },
      { number: 132, title: 'User feedback' },
    ],
  },
];

const ENGINEERING_TOPIC_COUNT = ENGINEERING_BOOKS.reduce(
  (sum, book) => sum + book.topics.length,
  0,
);

/** Full 44-book library: 14 engineering books (read) + 30 society, behavior & power books (queued). */
export const BOOKS: readonly [BookItem, ...BookItem[]] = [
  ...ENGINEERING_BOOKS,
  ...buildHumanitiesBooks(ENGINEERING_BOOKS.length + 1, ENGINEERING_TOPIC_COUNT + 1),
];

/** Default initial active book on /bookshelf (Stage 04: Designing Data-Intensive Applications). */
export const DEFAULT_BOOK_INDEX = 3;

export const BOOK_SLUGS: readonly string[] = BOOKS.map((book) => book.slug);

export const TOTAL_TOPICS: number = BOOKS.reduce((sum, book) => sum + book.topics.length, 0);

/** Default separated shelf collections across engineering and society/power curricula. */
export const DEFAULT_SHELVES: readonly ShelfCollection[] = [
  {
    slug: 'foundations',
    title: 'Foundations',
    description: 'Hardware, kernels, virtual memory, concurrency, and how packets cross the wire.',
    accentColor: 'var(--brand)',
    bookSlugs: BOOKS.filter((book) => book.track === 'Foundations').map((book) => book.slug),
  },
  {
    slug: 'backend',
    title: 'Backend',
    description:
      'Storage engines, replication, distributed consensus, system design, and service boundaries.',
    accentColor: 'var(--brand)',
    bookSlugs: BOOKS.filter((book) => book.track === 'Backend').map((book) => book.slug),
  },
  {
    slug: 'infra-and-ops',
    title: 'Infra & Ops',
    description:
      'Containers, Kubernetes orchestration, Terraform IaC, SLOs, and production reliability.',
    accentColor: 'var(--brand)',
    bookSlugs: BOOKS.filter((book) => book.track === 'Infra & Ops').map((book) => book.slug),
  },
  {
    slug: 'ai',
    title: 'AI',
    description:
      'Deep learning math, production ML pipelines, building LLMs from scratch, and AI systems.',
    accentColor: 'var(--brand)',
    bookSlugs: BOOKS.filter((book) => book.track === 'AI').map((book) => book.slug),
  },
  {
    slug: 'reasoning-and-systems',
    title: 'Reasoning & Systems',
    description:
      'Philosophy, argument construction, statistical reasoning, systems thinking, and media ecology.',
    accentColor: 'var(--brand)',
    bookSlugs: BOOKS.filter((book) => book.track === 'Reasoning & Systems').map(
      (book) => book.slug,
    ),
  },
  {
    slug: 'mind-and-society',
    title: 'Mind & Society',
    description:
      'Psychology, cultural anthropology, and sociology—how individuals, norms, and groups shape behavior.',
    accentColor: 'var(--brand)',
    bookSlugs: BOOKS.filter((book) => book.track === 'Mind & Society').map((book) => book.slug),
  },
  {
    slug: 'history-and-economics',
    title: 'History & Economics',
    description:
      'World history, historical method, incentives, markets, and empirical development economics.',
    accentColor: 'var(--brand)',
    bookSlugs: BOOKS.filter((book) => book.track === 'History & Economics').map(
      (book) => book.slug,
    ),
  },
  {
    slug: 'power-and-institutions',
    title: 'Power & Institutions',
    description:
      'Political theory, state capacity, the rule of law, institutional legibility, and geopolitics.',
    accentColor: 'var(--brand)',
    bookSlugs: BOOKS.filter((book) => book.track === 'Power & Institutions').map(
      (book) => book.slug,
    ),
  },
];

export const DEFAULT_SHELF_SLUGS: readonly string[] = DEFAULT_SHELVES.map((shelf) => shelf.slug);

/** Looks up a book by its URL slug. */
export const getBookBySlug = (slug: string): BookItem | undefined =>
  BOOKS.find((book) => book.slug === slug);

/** Index of a book by slug, or -1 if unknown. */
export const getBookIndexBySlug = (slug: string): number =>
  BOOKS.findIndex((book) => book.slug === slug);

/** Cyclic index lookup into {@link BOOKS}, always returning a valid book. */
export const getBookAt = (index: number): BookItem => {
  const wrapped = ((index % BOOKS.length) + BOOKS.length) % BOOKS.length;
  return BOOKS[wrapped] ?? BOOKS[0];
};

/** Cyclic previous and next books around `slug`. */
export const getAdjacentBooks = (slug: string): { prev: BookItem; next: BookItem } => {
  const safeIndex = Math.max(getBookIndexBySlug(slug), 0);
  return {
    prev: getBookAt(safeIndex - 1),
    next: getBookAt(safeIndex + 1),
  };
};

/** Returns the books belonging to `category` (`All` returns the entire shelf). */
export const getBooksByCategory = (category: BookCategory): readonly BookItem[] =>
  category === 'All' ? BOOKS : BOOKS.filter((book) => book.track === category);

/** Index of the first book in `track` within {@link BOOKS}. */
export const getTrackStartIndex = (track: BookTrack): number =>
  Math.max(
    0,
    BOOKS.findIndex((book) => book.track === track),
  );
