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
 * @file Migration-only input: personal reading history (3 completed library checkouts) and the
 * deduplicated technical reading list (22 queued books spanning Web & Languages, Foundations,
 * Backend, Security, and AI), moved verbatim from the bookshelf `_lib/reading-list-books.ts`.
 * The one-shot Sanity migration reads them through build-catalog.ts, and this folder is deleted
 * with it.
 *
 * Self-contained on purpose: relative imports only (`sanity exec` cannot resolve '@/'), and nothing
 * under src/ imports this.
 */

import type { RawCatalogBook } from './types';

/**
 * Completed books checked out and read, plus queued books from the personal reading list.
 * Duplicates already present in the core engineering catalog (OSTEP, DDIA, System Design
 * Interview, Building Microservices, Designing ML Systems, AI Engineering) are intentionally
 * omitted here and retained once in `engineering-books.ts`.
 */
export const RAW_PERSONAL_BOOKS: readonly RawCatalogBook[] = [
  // ── Web & Languages (Read) ───────────────────────────────────────────────────────────────
  {
    slug: 'job-ready-python',
    title: 'Job Ready Python',
    spineTitle: 'Job Ready Python',
    authors: 'Haythem Balti & Kimberly A. Weiss',
    spineAuthor: 'BALTI',
    publisher: 'Wiley',
    edition: '1st Edition',
    year: 2022,
    isbn: '978-1-11-981738-3',
    track: 'Web & Languages',
    status: 'completed',
    summary:
      'Hands-on Python fundamentals built for real engineering roles: data structures, object-oriented design, file I/O, exception handling, and working with databases and APIs.',
    url: 'https://www.wiley.com/en-us/Job+Ready+Python-p-9781119817383',
    topics: [
      'Core syntax, types, control flow & functions',
      'Lists, tuples, sets, dictionaries & comprehensions',
      'Object-oriented design, modules & packaging',
      'File I/O, structured data & exception handling',
      'Database access, web requests & practical workflows',
    ],
  },
  {
    slug: 'murachs-javascript-and-jquery',
    title: "Murach's JavaScript and jQuery",
    spineTitle: 'JavaScript & jQuery',
    authors: 'Mary Delamater & Zak Ruvalcaba',
    spineAuthor: 'MURACH',
    publisher: 'Mike Murach & Associates',
    edition: '4th Edition',
    year: 2020,
    isbn: '978-1-94-387262-6',
    track: 'Web & Languages',
    status: 'completed',
    summary:
      'Practical front-end JavaScript from DOM scripting and event handling to jQuery UI, asynchronous Fetch/AJAX requests, closures, and modular browser applications.',
    url: 'https://www.murach.com/shop/murach-s-javascript-and-jquery-4th-edition-detail',
    topics: [
      'DOM traversal, manipulation & event-driven UI',
      'Form validation, regex & client-side state',
      'jQuery selectors, effects, animations & plugins',
      'Asynchronous requests, JSON, Fetch & Promises',
      'Closures, prototypes, IIFEs & browser storage',
    ],
  },
  {
    slug: 'web-coding-and-development-all-in-one',
    title: 'Web Coding & Development All-in-One For Dummies',
    spineTitle: 'Web Coding & Dev',
    authors: 'Paul McFedries',
    spineAuthor: 'MCFEDRIES',
    publisher: 'Wiley',
    edition: '1st Edition',
    year: 2018,
    isbn: '978-1-11-947392-3',
    track: 'Web & Languages',
    status: 'completed',
    summary:
      'End-to-end web development primer spanning semantic HTML5, responsive CSS layout, interactive JavaScript, server-side scripting, databases, and deploying web applications.',
    url: 'https://openlibrary.org/isbn/9781119473923',
    topics: [
      'Semantic HTML5 structure & accessible markup',
      'CSS box model, Flexbox, Grid & responsive design',
      'Client-side scripting with modern JavaScript',
      'Server-side request handling, forms & persistence',
      'Full-stack integration, debugging & web deployment',
    ],
  },

  // ── Web & Languages (Queued) ─────────────────────────────────────────────────────────────
  {
    slug: 'learning-typescript',
    title: 'Learning TypeScript: Enhance Your Web Development Skills Using Type-Safe JavaScript',
    spineTitle: 'Learning TypeScript',
    authors: 'Josh Goldberg',
    spineAuthor: 'GOLDBERG',
    publisher: "O'Reilly Media",
    edition: '1st Edition',
    year: 2022,
    isbn: '978-1-09-811033-8',
    track: 'Web & Languages',
    status: 'queued',
    summary:
      'A clear progression from JavaScript into TypeScript’s structural type system: narrowing, unions, interfaces, generics, declaration files, and compiler configuration.',
    url: 'https://www.learningtypescript.com/',
    topics: [
      'Structural typing, type inference & assignability',
      'Unions, literals & control-flow type narrowing',
      'Interfaces, object shapes & function signatures',
      'Generics, constraints & type modifiers',
      'Declaration files, compiler options & incremental adoption',
    ],
  },
  {
    slug: 'programming-typescript',
    title: 'Programming TypeScript: Making Your JavaScript Applications Scale',
    spineTitle: 'Programming TypeScript',
    authors: 'Boris Cherny',
    spineAuthor: 'CHERNY',
    publisher: "O'Reilly Media",
    edition: '1st Edition',
    year: 2019,
    isbn: '978-1-49-203765-1',
    track: 'Web & Languages',
    status: 'queued',
    summary:
      'Deep tour of TypeScript’s type theory and architecture for large codebases: variance, conditional and mapped types, error handling patterns, concurrency, and interop.',
    url: 'https://www.oreilly.com/library/view/programming-typescript/9781492037644/',
    topics: [
      'Type hierarchy, subtyping & variance rules',
      'Polymorphic functions, classes & mixins',
      'Mapped, conditional & inferred utility types',
      'Typed error handling, async flows & worker protocols',
      'Module resolution, namespaces & JS migration strategies',
    ],
  },
  {
    slug: 'effective-typescript',
    title: 'Effective TypeScript: 83 Specific Ways to Improve Your TypeScript',
    spineTitle: 'Effective TypeScript',
    authors: 'Dan Vanderkam',
    spineAuthor: 'VANDERKAM',
    publisher: "O'Reilly Media",
    edition: '2nd Edition',
    year: 2024,
    isbn: '978-1-09-815506-3',
    track: 'Web & Languages',
    status: 'queued',
    summary:
      '83 battle-tested idioms for writing precise, maintainable TypeScript: thinking in sets, minimizing unsoundness, designing ergonomic generic APIs, and avoiding type-level pitfalls.',
    url: 'https://effectivetypescript.com/',
    topics: [
      'Thinking of types as sets of runtime values',
      'Preferring type inference & avoiding redundant annotations',
      'Designing valid-state-only discriminated unions',
      'Taming any, unknown & type-safe boundary validation',
      'Writing maintainable generic types, testing types & d.ts ergonomics',
    ],
  },
  {
    slug: 'modern-angular',
    title: 'Modern Angular',
    spineTitle: 'Modern Angular',
    authors: 'Armen Vardanyan',
    spineAuthor: 'VARDANYAN',
    publisher: 'Manning',
    edition: '1st Edition',
    year: 2025,
    isbn: '978-1-63-343692-3',
    track: 'Web & Languages',
    status: 'queued',
    summary:
      'Building contemporary Angular applications with standalone components, Signals reactivity, built-in control flow, server-side rendering, hydration, and zoneless change detection.',
    url: 'https://www.manning.com/books/modern-angular',
    topics: [
      'Standalone components, inject() & streamlined DI',
      'Fine-grained reactivity with Signals & RxJS interop',
      'Built-in control flow, deferrable views & routing',
      'SSR, incremental hydration & performance tuning',
      'Zoneless change detection & modern testing patterns',
    ],
  },

  // ── Foundations (Queued) ─────────────────────────────────────────────────────────────────
  {
    slug: 'python-programming-zelle',
    title: 'Python Programming: An Introduction to Computer Science',
    spineTitle: 'Python Programming',
    authors: 'John M. Zelle',
    spineAuthor: 'ZELLE',
    publisher: 'Franklin, Beedle & Associates',
    edition: '3rd Edition',
    year: 2016,
    isbn: '978-1-59-028275-5',
    track: 'Foundations',
    status: 'queued',
    summary:
      'Classic computer science fundamentals taught through Python: problem decomposition, numerical representations, top-down design, object modeling, recursion, and algorithm analysis.',
    url: 'https://mcsp.wartburg.edu/zelle/python/',
    topics: [
      'Computation models, variables & numeric representations',
      'Functions, control structures & top-down decomposition',
      'Data collections, encapsulation & object-oriented design',
      'Recursion, searching, sorting & asymptotic efficiency',
      'Simulation modeling & program correctness',
    ],
  },
  {
    slug: 'no-bullshit-guide-to-math-and-physics',
    title: 'No Bullshit Guide to Math and Physics',
    spineTitle: 'Math & Physics',
    authors: 'Ivan Savov',
    spineAuthor: 'SAVOV',
    publisher: 'Minireference',
    edition: '5th Edition',
    year: 2014,
    isbn: '978-0-99-200100-1',
    track: 'Foundations',
    status: 'queued',
    summary:
      'An integrated, intuition-first tour of calculus and classical mechanics—connecting algebra, vectors, derivatives, integrals, and Newtonian dynamics without textbook fluff.',
    url: 'https://minireference.com/',
    topics: [
      'Functions, trigonometry, exponentials & vector geometry',
      'Limits, derivatives & rates of change',
      'Integrals, accumulation & the fundamental theorem',
      'Kinematics, Newton’s laws, work & conservation of energy',
      'Momentum, rotational dynamics & simple harmonic motion',
    ],
  },
  {
    slug: 'no-bullshit-guide-to-linear-algebra',
    title: 'No Bullshit Guide to Linear Algebra',
    spineTitle: 'Linear Algebra',
    authors: 'Ivan Savov',
    spineAuthor: 'SAVOV',
    publisher: 'Minireference',
    edition: '2nd Edition',
    year: 2017,
    isbn: '978-0-99-200102-5',
    track: 'Foundations',
    status: 'queued',
    summary:
      'Practical linear algebra from vectors and matrix mechanics to vector spaces, eigenvalues, SVD, and direct applications in graphics, optimization, and machine learning.',
    url: 'https://minireference.com/',
    topics: [
      'Vectors, dot products, projections & linear combinations',
      'Systems of linear equations & Gaussian elimination',
      'Vector spaces, basis, rank & linear transformations',
      'Determinants, eigenvalues, eigenvectors & diagonalization',
      'Orthogonality, least squares & singular value decomposition',
    ],
  },

  // ── Backend (Queued) ─────────────────────────────────────────────────────────────────────
  {
    slug: 'clean-code',
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    spineTitle: 'Clean Code',
    authors: 'Robert C. Martin',
    spineAuthor: 'MARTIN',
    publisher: 'Prentice Hall',
    edition: '1st Edition',
    year: 2008,
    isbn: '978-0-13-235088-4',
    track: 'Backend',
    status: 'queued',
    summary:
      'Principles and heuristics for readable, maintainable production code: meaningful names, small focused functions, boundary hygiene, unit testing discipline, and refactoring smells.',
    url: 'https://www.pearson.com/en-us/subject-catalog/p/clean-code-a-handbook-of-agile-software-craftsmanship/P200000009044',
    topics: [
      'Intention-revealing naming & self-documenting code',
      'Small cohesive functions, error handling & clean boundaries',
      'Unit testing, TDD & keeping test suites maintainable',
      'Class cohesion, SOLID boundaries & emergent design',
      'Concurrency hazards & iterative refactoring heuristics',
    ],
  },
  {
    slug: 'head-first-design-patterns',
    title:
      'Head First Design Patterns: Building Extensible and Maintainable Object-Oriented Software',
    spineTitle: 'Head First Design Patterns',
    authors: 'Eric Freeman & Elisabeth Robson',
    spineAuthor: 'FREEMAN',
    publisher: "O'Reilly Media",
    edition: '2nd Edition',
    year: 2020,
    isbn: '978-1-49-207800-5',
    track: 'Backend',
    status: 'queued',
    summary:
      'Visual, example-driven guide to classic object-oriented design patterns—favoring composition over inheritance across Strategy, Observer, Decorator, Factory, Command, Adapter, and Proxy.',
    url: 'https://www.oreilly.com/library/view/head-first-design/9781492077992/',
    topics: [
      'Composition over inheritance & Strategy / Observer patterns',
      'Decorator, Factory Method & Abstract Factory design',
      'Command, Adapter, Facade & Template Method workflows',
      'Iterator, Composite, State & Proxy abstractions',
      'Compound patterns & recognizing anti-patterns in the wild',
    ],
  },
  {
    slug: 'web-scalability-for-startup-engineers',
    title: 'Web Scalability for Startup Engineers',
    spineTitle: 'Web Scalability',
    authors: 'Artur Ejsmont',
    spineAuthor: 'EJSMONT',
    publisher: 'McGraw-Hill',
    edition: '1st Edition',
    year: 2015,
    isbn: '978-0-07-184365-2',
    track: 'Backend',
    status: 'queued',
    summary:
      'Pragmatic architectural roadmap for scaling web applications from early prototype to millions of users: stateless frontends, multi-layer caching, data sharding, queues, and search.',
    url: 'https://openlibrary.org/isbn/9780071843652',
    topics: [
      'Stateless application tiers, load balancing & CDNs',
      'Layered caching strategies & invalidation tradeoffs',
      'Relational scaling, read replicas, partitioning & NoSQL',
      'Asynchronous message queues & background workers',
      'Full-text search, observability & iterative scaling discipline',
    ],
  },

  // ── Security (Queued) ────────────────────────────────────────────────────────────────────
  {
    slug: 'linux-basics-for-hackers',
    title:
      'Linux Basics for Hackers: Getting Started with Networking, Scripting, and Security in Kali',
    spineTitle: 'Linux Basics for Hackers',
    authors: 'OccupyTheWeb',
    spineAuthor: 'OTW',
    publisher: 'No Starch Press',
    edition: '2nd Edition',
    year: 2025,
    isbn: '978-1-71-850354-0',
    track: 'Security',
    status: 'queued',
    summary:
      'Practical Linux command-line fluency for security engineers using Kali Linux: filesystem permissions, networking tools, process control, logging, bash/Python scripting, and service hardening.',
    url: 'https://nostarch.com/linux-basics-hackers-2nd-edition',
    topics: [
      'Shell navigation, text manipulation & file permissions',
      'Network interface configuration, DNS & traffic inspection',
      'Process management, systemd services & log auditing',
      'Bash and Python scripting for security automation',
      'Kernel modules, archives, Tor/proxy chains & system hardening',
    ],
  },
  {
    slug: 'getting-started-becoming-a-master-hacker',
    title: 'Getting Started Becoming a Master Hacker',
    spineTitle: 'Master Hacker',
    authors: 'OccupyTheWeb',
    spineAuthor: 'OTW',
    publisher: 'Hackers-Arise',
    edition: '1st Edition',
    year: 2019,
    isbn: '978-1-71-172929-9',
    track: 'Security',
    status: 'queued',
    summary:
      'Structured introduction to offensive security methodology: lab setup, reconnaissance, vulnerability scanning, exploitation fundamentals, password auditing, and defensive takeaways.',
    url: 'https://www.hackers-arise.com/',
    topics: [
      'Building isolated virtualization & penetration testing labs',
      'Passive and active reconnaissance & service enumeration',
      'Vulnerability assessment, Nmap & exploitation frameworks',
      'Password cracking, privilege escalation & post-exploitation',
      'Translating offensive findings into defensive controls',
    ],
  },
  {
    slug: 'network-basics-for-hackers',
    title: 'Network Basics for Hackers: How Networks Work and How They Break',
    spineTitle: 'Network Basics for Hackers',
    authors: 'OccupyTheWeb',
    spineAuthor: 'OTW',
    publisher: 'Hackers-Arise',
    edition: '1st Edition',
    year: 2023,
    isbn: '979-8-37-329004-3',
    track: 'Security',
    status: 'queued',
    summary:
      'Deep look at how protocols behave on the wire and where they break: TCP/IP headers, Wireshark packet analysis, ARP/DNS/BGP weaknesses, wireless protocols, and firewall evasion.',
    url: 'https://www.hackers-arise.com/',
    topics: [
      'TCP/IP encapsulation, packet headers & subnetting',
      'Traffic capture, BPF filters & Wireshark forensics',
      'Protocol weaknesses across ARP, DNS, SMB & HTTP',
      'Firewalls, IDS/IPS detection & tunneling mechanics',
      'Wireless security, pivoting & defensive network monitoring',
    ],
  },
  {
    slug: 'hacking-apis',
    title: 'Hacking APIs: Breaking Web Application Programming Interfaces',
    spineTitle: 'Hacking APIs',
    authors: 'Corey J. Ball',
    spineAuthor: 'BALL',
    publisher: 'No Starch Press',
    edition: '1st Edition',
    year: 2022,
    isbn: '978-1-71-850244-4',
    track: 'Security',
    status: 'queued',
    summary:
      'Hands-on API security testing mapped to OWASP API Top 10: endpoint discovery, broken object-level authorization, JWT/OAuth attacks, mass assignment, GraphQL abuse, and remediation.',
    url: 'https://nostarch.com/hacking-apis',
    topics: [
      'API reconnaissance, OpenAPI/Swagger & endpoint fuzzing',
      'Broken Object-Level (BOLA) & Function-Level Authorization',
      'Authentication flaws, JWT manipulation & OAuth pitfalls',
      'Mass assignment, excessive data exposure & rate-limit bypasses',
      'GraphQL introspection/injection & hardening API gateways',
    ],
  },

  // ── AI (Queued) ──────────────────────────────────────────────────────────────────────────
  {
    slug: 'how-ai-works',
    title: 'How AI Works: From Sorcery to Science',
    spineTitle: 'How AI Works',
    authors: 'Ronald T. Kneusel',
    spineAuthor: 'KNEUSEL',
    publisher: 'No Starch Press',
    edition: '1st Edition',
    year: 2023,
    isbn: '978-1-71-850372-4',
    track: 'AI',
    status: 'queued',
    summary:
      'Clear, demystified conceptual tour of modern artificial intelligence—from classical ML and neural networks to CNNs, diffusion models, and large language models—without hiding behind hype.',
    url: 'https://nostarch.com/how-ai-works',
    topics: [
      'From symbolic AI to statistical machine learning',
      'How neural networks learn representations from data',
      'Computer vision with convolutional neural networks',
      'Transformers, attention & how large language models work',
      'Generative diffusion models, limits & realistic capabilities',
    ],
  },
  {
    slug: 'hundred-page-machine-learning-book',
    title: 'The Hundred-Page Machine Learning Book',
    spineTitle: 'Hundred-Page ML Book',
    authors: 'Andriy Burkov',
    spineAuthor: 'BURKOV',
    publisher: 'Andriy Burkov',
    edition: '1st Edition',
    year: 2019,
    isbn: '978-1-99-957950-0',
    track: 'AI',
    status: 'queued',
    summary:
      'A dense, high-signal synthesis of supervised, unsupervised, and deep learning: notation, SVMs, ensembles, feature engineering, hyperparameter tuning, and evaluation.',
    url: 'https://themlbook.com/',
    topics: [
      'Mathematical notation, loss functions & gradient descent',
      'Linear models, logistic regression, SVMs & decision trees',
      'Bias-variance tradeoff, regularization & cross-validation',
      'Ensemble methods, clustering & dimensionality reduction',
      'Neural networks, embeddings & practical ML engineering',
    ],
  },
  {
    slug: 'data-science-from-scratch',
    title: 'Data Science from Scratch: First Principles with Python',
    spineTitle: 'Data Science from Scratch',
    authors: 'Joel Grus',
    spineAuthor: 'GRUS',
    publisher: "O'Reilly Media",
    edition: '2nd Edition',
    year: 2019,
    isbn: '978-1-49-204113-9',
    track: 'AI',
    status: 'queued',
    summary:
      'Implementing core data science and machine learning algorithms from scratch in pure Python—linear algebra, probability, hypothesis testing, gradient descent, k-NN, Naive Bayes, and neural nets.',
    url: 'https://www.oreilly.com/library/view/data-science-from/9781492041122/',
    topics: [
      'Vectors, matrices, statistics & probability from scratch',
      'Hypothesis testing, p-values & gradient descent mechanics',
      'Data ingestion, cleaning, exploration & visualization',
      'k-NN, Naive Bayes, linear/logistic regression & trees',
      'Clustering, NLP, recommender systems & network analysis',
    ],
  },
  {
    slug: 'hands-on-machine-learning',
    title:
      'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow: Concepts, Tools, and Techniques to Build Intelligent Systems',
    spineTitle: 'Hands-On Machine Learning',
    authors: 'Aurélien Géron',
    spineAuthor: 'GÉRON',
    publisher: "O'Reilly Media",
    edition: '3rd Edition',
    year: 2022,
    isbn: '978-1-09-812597-4',
    track: 'AI',
    status: 'queued',
    summary:
      'End-to-end practitioner’s guide to classical ML and deep learning: Scikit-Learn pipelines, ensembles, Keras/TensorFlow neural networks, CNNs, RNNs, Transformers, and deployment.',
    url: 'https://www.oreilly.com/library/view/hands-on-machine-learning/9781098125967/',
    topics: [
      'End-to-end ML project framing, validation & Scikit-Learn pipelines',
      'Classification, regression, SVMs, random forests & boosting',
      'Dimensionality reduction, clustering & anomaly detection',
      'Training deep neural nets, CNNs & sequence models in Keras',
      'Attention, Transformers, generative models & serving at scale',
    ],
  },
  {
    slug: 'tinyml',
    title:
      'TinyML: Machine Learning with TensorFlow Lite on Arduino and Ultra-Low-Power Microcontrollers',
    spineTitle: 'TinyML',
    authors: 'Pete Warden & Daniel Situnayake',
    spineAuthor: 'WARDEN',
    publisher: "O'Reilly Media",
    edition: '1st Edition',
    year: 2019,
    isbn: '978-1-49-205204-3',
    track: 'AI',
    status: 'queued',
    summary:
      'Running neural networks on milliwatt microcontrollers with kilobytes of RAM: quantization, pruning, wake-word audio, vision, IMU gesture recognition, and TensorFlow Lite for Microcontrollers.',
    url: 'https://tinymlbook.com/',
    topics: [
      'Embedded constraints: SRAM, flash, latency & power budgets',
      'Training compact models & post-training integer quantization',
      'Audio wake-word detection & spectrogram feature pipelines',
      'Low-power person detection & accelerometer gesture models',
      'Deploying C++ inference loops with TFLite Micro',
    ],
  },
  {
    slug: 'ai-at-the-edge',
    title: 'AI at the Edge: Solving Real-World Problems with Embedded Machine Learning',
    spineTitle: 'AI at the Edge',
    authors: 'Daniel Situnayake & Jenny Plunkett',
    spineAuthor: 'SITUNAYAKE',
    publisher: "O'Reilly Media",
    edition: '1st Edition',
    year: 2023,
    isbn: '978-1-09-812020-7',
    track: 'AI',
    status: 'queued',
    summary:
      'Engineering edge-AI products end to end: sensor selection, embedded DSP pipelines, dataset collection in the field, hardware-aware model optimization, and fleet lifecycle management.',
    url: 'https://www.oreilly.com/library/view/ai-at-the/9781098120191/',
    topics: [
      'Choosing sensors, MCUs, NPUs & edge hardware architectures',
      'Field data collection, labeling & handling real-world noise',
      'Digital signal processing paired with lightweight ML models',
      'Quantization, pruning & latency/memory benchmarking on device',
      'OTA updates, privacy by design & edge fleet monitoring',
    ],
  },
  {
    slug: 'quantum-machine-learning-and-optimisation-in-finance',
    title: 'Quantum Machine Learning and Optimisation in Finance',
    spineTitle: 'Quantum ML in Finance',
    authors: 'Antoine Jacquier & Oleksiy Kondratyev',
    spineAuthor: 'JACQUIER',
    publisher: 'Packt Publishing',
    edition: '1st Edition',
    year: 2022,
    isbn: '978-1-80-181357-0',
    track: 'AI',
    status: 'queued',
    summary:
      'Bridging quantum computing and quantitative finance: quantum circuits, QAOA and quantum annealing for portfolio optimization, amplitude estimation for pricing, and quantum neural networks.',
    url: 'https://openlibrary.org/isbn/9781801813570',
    topics: [
      'Qubits, quantum gates, entanglement & NISQ hardware limits',
      'Quantum annealing & QUBO formulations for portfolio optimization',
      'Variational algorithms (VQE/QAOA) & hybrid classical loops',
      'Quantum amplitude estimation for Monte Carlo derivatives pricing',
      'Quantum kernels, parameterized circuits & financial ML benchmarks',
    ],
  },
  {
    slug: 'ai-superpowers',
    title: 'AI Superpowers: China, Silicon Valley, and the New World Order',
    spineTitle: 'AI Superpowers',
    authors: 'Kai-Fu Lee',
    spineAuthor: 'KAI-FU LEE',
    publisher: 'Houghton Mifflin Harcourt',
    edition: '1st Edition',
    year: 2018,
    isbn: '978-1-32-854639-5',
    track: 'AI',
    status: 'queued',
    summary:
      'Comparative analysis of the US and Chinese AI ecosystems—contrasting research breakthroughs vs. implementation scale, mobile-data flywheels, industrial policy, and the future of work.',
    url: 'https://aisuperpowers.com/',
    topics: [
      'The shift from AI discovery to massive implementation scale',
      'Silicon Valley research culture vs. China’s execution ecosystems',
      'The four waves of AI: internet, business, perception & autonomy',
      'Data moats, venture capital & state industrial strategy',
      'Labor displacement, economic inequality & human-centered roles',
    ],
  },
];
