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
 * @file Human Behavior, Society & Political Power curriculum: 30 books spanning Philosophy &
 * Reasoning, Statistics, Systems Thinking, Media, Psychology, Anthropology, Sociology, History,
 * Economics, Politics, Law & Institutions, and International Relations.
 * Organized into 4 shelf tracks following the progression:
 * reasoning & systems -> mind & society -> history & economics -> power & institutions.
 */

import { type BookItem, type BookTrack, getLiveConsoleSpineTheme } from './books';

interface RawHumanitiesBook {
  readonly slug: string;
  readonly title: string;
  readonly spineTitle: string;
  readonly authors: string;
  readonly spineAuthor: string;
  readonly publisher: string;
  readonly edition: string;
  readonly year: number;
  readonly isbn: string;
  readonly track: BookTrack;
  readonly summary: string;
  readonly url: string;
  readonly topics: readonly string[];
}

const RAW_HUMANITIES_BOOKS: readonly RawHumanitiesBook[] = [
  // ── Reasoning & Systems (Philosophy, Statistics, Systems Thinking, Media) ──────────────
  {
    slug: 'think-philosophy',
    title: 'Think: A Compelling Introduction to Philosophy',
    spineTitle: 'Think',
    authors: 'Simon Blackburn',
    spineAuthor: 'BLACKBURN',
    publisher: 'Oxford University Press',
    edition: '1st Edition',
    year: 1999,
    isbn: '978-0-19-285425-4',
    track: 'Reasoning & Systems',
    summary:
      'An accessible introduction to foundational philosophical questions—knowledge, mind, free will, identity, and ethics—and what makes an argument stand up to scrutiny.',
    url: 'https://global.oup.com/academic/product/think-9780192854254',
    topics: [
      'Knowledge, skepticism & justified belief',
      'Mind, consciousness & the body problem',
      'Free will, determinism & responsibility',
      'Personal identity across time',
      'Moral reasoning & what we owe others',
    ],
  },
  {
    slug: 'a-rulebook-for-arguments',
    title: 'A Rulebook for Arguments',
    spineTitle: 'A Rulebook for Arguments',
    authors: 'Anthony Weston',
    spineAuthor: 'WESTON',
    publisher: 'Hackett Publishing',
    edition: '6th Edition',
    year: 2024,
    isbn: '978-1-64-792184-2',
    track: 'Reasoning & Systems',
    summary:
      'Practical rules for constructing clear arguments, assessing evidence and sources, reasoning by analogy and cause, and spotting hidden fallacies.',
    url: 'https://hackettpublishing.com/a-rulebook-for-arguments-sixth-edition-g',
    topics: [
      'Composing concise, structured arguments',
      'Arguments by example, analogy & authority',
      'Causal reasoning & competing explanations',
      'Deductive forms & valid inference',
      'Recognizing informal fallacies & weak evidence',
    ],
  },
  {
    slug: 'justice-sandel',
    title: "Justice: What's the Right Thing to Do?",
    spineTitle: 'Justice',
    authors: 'Michael J. Sandel',
    spineAuthor: 'SANDEL',
    publisher: 'Farrar, Straus and Giroux',
    edition: 'Reprint Edition',
    year: 2010,
    isbn: '978-0-37-453250-5',
    track: 'Reasoning & Systems',
    summary:
      'Examines competing moral philosophies—utilitarianism, libertarianism, Kantian duty, Rawlsian fairness, and virtue—through concrete political and social dilemmas.',
    url: 'https://www.wcfia.harvard.edu/publications/justice-whats-right-thing-do',
    topics: [
      'Utilitarianism & welfare maximization',
      'Libertarian self-ownership & free markets',
      'Kantian autonomy & categorical duty',
      'Rawls, the veil of ignorance & distributive fairness',
      'Aristotelian virtue & civic obligation',
    ],
  },
  {
    slug: 'the-art-of-statistics',
    title: 'The Art of Statistics: How to Learn from Data',
    spineTitle: 'The Art of Statistics',
    authors: 'David Spiegelhalter',
    spineAuthor: 'SPIEGELHALTER',
    publisher: 'Basic Books',
    edition: 'Paperback Edition',
    year: 2021,
    isbn: '978-1-54-167570-4',
    track: 'Reasoning & Systems',
    summary:
      'Builds statistical literacy for interpreting data, uncertainty, probability, causal claims, and real-world risks without getting misled by noisy headlines.',
    url: 'https://www.hachettebookgroup.com/titles/david-spiegelhalter/the-art-of-statistics/9781541675704/',
    topics: [
      'Summarizing distributions & resisting misleading averages',
      'Sampling bias, regression to the mean & confounding',
      'Probability, risk framing & base-rate neglect',
      'Confidence intervals, p-values & Bayesian updating',
      'Evaluating predictive models & causal claims',
    ],
  },
  {
    slug: 'thinking-in-systems',
    title: 'Thinking in Systems: A Primer',
    spineTitle: 'Thinking in Systems',
    authors: 'Donella H. Meadows',
    spineAuthor: 'MEADOWS',
    publisher: 'Chelsea Green Publishing',
    edition: '1st Edition',
    year: 2008,
    isbn: '978-1-60-358055-7',
    track: 'Reasoning & Systems',
    summary:
      'Introduces stocks, flows, feedback loops, delays, resilience, and leverage points—connecting economics, institutions, and human behavior as dynamic systems.',
    url: 'https://www.chelseagreen.com/product/thinking-in-systems/',
    topics: [
      'Stocks, flows & balancing vs reinforcing feedback loops',
      'Delays, oscillations & nonlinear thresholds',
      'System traps: policy resistance & tragedy of the commons',
      'Resilience, self-organization & hierarchy',
      'Twelve leverage points to intervene in a system',
    ],
  },
  {
    slug: 'amusing-ourselves-to-death',
    title: 'Amusing Ourselves to Death: Public Discourse in the Age of Show Business',
    spineTitle: 'Amusing Ourselves to Death',
    authors: 'Neil Postman',
    spineAuthor: 'POSTMAN',
    publisher: 'Penguin Books',
    edition: '20th Anniversary Edition',
    year: 2005,
    isbn: '978-0-14-303653-1',
    track: 'Reasoning & Systems',
    summary:
      'A classic critique of how entertainment-first media architectures reshape epistemology, journalism, politics, and public conversation.',
    url: 'https://www.penguinrandomhouse.com/books/297276/amusing-ourselves-to-death-by-neil-postman/',
    topics: [
      'Media as epistemology: print vs broadcast discourse',
      'Orwell vs Huxley: censorship vs distraction',
      'News as entertainment & context collapse',
      'Political persuasion under image-driven media',
      'Attention economies & institutional discourse',
    ],
  },

  // ── Mind & Society (Psychology, Anthropology, Sociology) ───────────────────────────────
  {
    slug: 'psychology-2e',
    title: 'Psychology 2e',
    spineTitle: 'Psychology 2e',
    authors: 'Rose M. Spielman, William J. Jenkins & Marilyn D. Lovett (OpenStax)',
    spineAuthor: 'OPENSTAX',
    publisher: 'OpenStax',
    edition: '2nd Edition',
    year: 2020,
    isbn: '978-1-97-507645-0',
    track: 'Mind & Society',
    summary:
      'A broad open-access survey of psychological science covering perception, learning, memory, cognition, motivation, development, and social influence.',
    url: 'https://openstax.org/books/psychology-2e/pages/1-introduction',
    topics: [
      'Experimental methods & psychological measurement',
      'Sensation, perception & attentional bottlenecks',
      'Conditioning, reinforcement & observational learning',
      'Memory encoding, heuristics & cognitive bias',
      'Social influence, conformity & group dynamics',
    ],
  },
  {
    slug: 'the-righteous-mind',
    title: 'The Righteous Mind: Why Good People Are Divided by Politics and Religion',
    spineTitle: 'The Righteous Mind',
    authors: 'Jonathan Haidt',
    spineAuthor: 'HAIDT',
    publisher: 'Vintage Books',
    edition: 'Reprint Edition',
    year: 2013,
    isbn: '978-0-30-745577-2',
    track: 'Mind & Society',
    summary:
      'Explores moral intuition, post-hoc rationalization, Moral Foundations Theory, and how group loyalty drives political and ideological disagreement.',
    url: 'https://www.penguinrandomhouse.com/books/73535/the-righteous-mind-by-jonathan-haidt/',
    topics: [
      'Intuition first, strategic reasoning second',
      'The elephant and the rider model of judgment',
      'Six moral foundations across political cultures',
      'Groupishness, hive psychology & sacred values',
      'Why moral arguments talk past opposing coalitions',
    ],
  },
  {
    slug: 'behave',
    title: 'Behave: The Biology of Humans at Our Best and Worst',
    spineTitle: 'Behave',
    authors: 'Robert M. Sapolsky',
    spineAuthor: 'SAPOLSKY',
    publisher: 'Penguin Books',
    edition: 'Paperback Edition',
    year: 2018,
    isbn: '978-0-73-522278-6',
    track: 'Mind & Society',
    summary:
      'Traces human behavior backward across timescales—from milliseconds of neural firing and hormones to adolescence, culture, ecology, and deep evolution.',
    url: 'https://www.penguinrandomhouse.com/books/311787/behave-by-robert-m-sapolsky/9780735222786/',
    topics: [
      'Amygdala, prefrontal cortex & dopamine dynamics',
      'Endocrinology: testosterone, oxytocin & stress',
      'Neuroplasticity, childhood development & epigenetics',
      'In-group/out-group categorization & empathy',
      'Hierarchy, cooperation & biological context of morality',
    ],
  },
  {
    slug: 'small-places-large-issues',
    title: 'Small Places, Large Issues: An Introduction to Social and Cultural Anthropology',
    spineTitle: 'Small Places, Large Issues',
    authors: 'Thomas Hylland Eriksen',
    spineAuthor: 'ERIKSEN',
    publisher: 'Pluto Press',
    edition: '4th Edition',
    year: 2015,
    isbn: '978-0-74-533593-3',
    track: 'Mind & Society',
    summary:
      'A comparative introduction to social and cultural anthropology showing how kinship, reciprocity, ritual, identity, and local custom organize human life.',
    url: 'https://www.plutobooks.com/product/small-places-large-issues/',
    topics: [
      'Ethnographic fieldwork & cultural comparison',
      'Kinship, descent, marriage & social obligation',
      'Gift exchange, reciprocity & informal economies',
      'Religion, ritual & symbolic classification',
      'Ethnicity, nationalism & globalization from below',
    ],
  },
  {
    slug: 'the-art-of-being-human',
    title: 'The Art of Being Human: A Textbook for Cultural Anthropology',
    spineTitle: 'The Art of Being Human',
    authors: 'Michael Wesch',
    spineAuthor: 'WESCH',
    publisher: 'New Prairie Press',
    edition: 'Open Edition',
    year: 2018,
    isbn: '978-1-94-454815-5',
    track: 'Mind & Society',
    summary:
      'An open-access introduction to cultural anthropology built around hands-on field exercises for questioning familiar cultural assumptions.',
    url: 'https://anth101.com/book/',
    topics: [
      'Making the familiar strange through fieldwork',
      'Language, shared symbols & cultural framing',
      'Perspective-taking & participant observation',
      'Social norms, taboo & everyday ritual',
      'Media, belonging & cultural change',
    ],
  },
  {
    slug: 'the-mushroom-at-the-end-of-the-world',
    title: 'The Mushroom at the End of the World: On the Possibility of Life in Capitalist Ruins',
    spineTitle: 'Mushroom at the End of the World',
    authors: 'Anna Lowenhaupt Tsing',
    spineAuthor: 'TSING',
    publisher: 'Princeton University Press',
    edition: 'Paperback Edition',
    year: 2021,
    isbn: '978-0-69-122055-0',
    track: 'Mind & Society',
    summary:
      'A multi-sited ethnography tracing the matsutake mushroom trade to show how precarious livelihoods, global supply chains, and disturbed ecologies intersect.',
    url: 'https://press.princeton.edu/books/paperback/9780691220550/the-mushroom-at-the-end-of-the-world',
    topics: [
      'Multi-sited ethnography across global supply chains',
      'Salvage accumulation & non-standardized labor',
      'Scalability vs non-scalable ecological assemblages',
      'Informal economies & migrant foraging communities',
      'Disturbed landscapes & unintended collaboration',
    ],
  },
  {
    slug: 'introduction-to-sociology-3e',
    title: 'Introduction to Sociology 3e',
    spineTitle: 'Introduction to Sociology 3e',
    authors: 'Tonja R. Conerly, Kathleen Holmes & Asha Lal Tamang (OpenStax)',
    spineAuthor: 'OPENSTAX',
    publisher: 'OpenStax',
    edition: '3rd Edition',
    year: 2021,
    isbn: '978-1-95-169336-7',
    track: 'Mind & Society',
    summary:
      'A foundational open-access sociology survey examining socialization, social stratification, organizations, institutions, and collective change.',
    url: 'https://openstax.org/details/books/introduction-sociology-3e',
    topics: [
      'Sociological theory: functionalism, conflict & interaction',
      'Socialization, roles & institutional norms',
      'Class stratification & social mobility',
      'Bureaucracies, networks & organizational power',
      'Social movements & demographic transformation',
    ],
  },
  {
    slug: 'the-sociological-imagination',
    title: 'The Sociological Imagination',
    spineTitle: 'The Sociological Imagination',
    authors: 'C. Wright Mills',
    spineAuthor: 'MILLS',
    publisher: 'Oxford University Press',
    edition: '40th Anniversary Edition',
    year: 2000,
    isbn: '978-0-19-513373-8',
    track: 'Mind & Society',
    summary:
      'The classic manifesto on connecting private troubles with public issues—locating individual biography inside broader social structures and historical forces.',
    url: 'https://books.google.com/books/about/The_Sociological_Imagination.html?id=r9GM5c0MbvQC',
    topics: [
      'Personal troubles vs public structural issues',
      'Intersection of biography, history & social structure',
      'Critique of grand theory & abstracted empiricism',
      'Intellectual craftsmanship & research discipline',
      'Public sociology & democratic accountability',
    ],
  },
  {
    slug: 'evicted',
    title: 'Evicted: Poverty and Profit in the American City',
    spineTitle: 'Evicted',
    authors: 'Matthew Desmond',
    spineAuthor: 'DESMOND',
    publisher: 'Crown / Broadway Books',
    edition: 'Paperback Edition',
    year: 2017,
    isbn: '978-0-55-344745-3',
    track: 'Mind & Society',
    summary:
      'Follows eight families and landlords in Milwaukee to show how housing instability, eviction courts, and private rental markets actively reproduce urban poverty.',
    url: 'https://www.penguinrandomhouse.com/books/247816/evicted-by-matthew-desmond/',
    topics: [
      'Ethnographic fieldwork in low-income rental markets',
      'Eviction as a cause—not only symptom—of poverty',
      'Landlord economics, risk pricing & housing courts',
      'Neighborhood destabilization & cascading job loss',
      'Housing vouchers, legal aid & policy interventions',
    ],
  },

  // ── History & Economics ────────────────────────────────────────────────────────────────
  {
    slug: 'the-human-web',
    title: "The Human Web: A Bird's-Eye View of World History",
    spineTitle: 'The Human Web',
    authors: 'J. R. McNeill & William H. McNeill',
    spineAuthor: 'MCNEILL',
    publisher: 'W. W. Norton & Company',
    edition: '1st Edition',
    year: 2003,
    isbn: '978-0-39-392568-5',
    track: 'History & Economics',
    summary:
      'Frames world history as expanding webs of exchange—showing how trade, migration, disease, ideas, and technology linked human societies into a single global network.',
    url: 'https://wwnorton.co.uk/books/9780393925685-the-human-web',
    topics: [
      'Local webs to metropolitan & Old World networks',
      'Information flow, cooperation & competitive selection',
      'Agriculture, urbanization & empire consolidation',
      'Columbian exchange & the first truly global web',
      'Energy transitions, industrialization & modern scale',
    ],
  },
  {
    slug: 'the-silk-roads',
    title: 'The Silk Roads: A New History of the World',
    spineTitle: 'The Silk Roads',
    authors: 'Peter Frankopan',
    spineAuthor: 'FRANKOPAN',
    publisher: 'Bloomsbury',
    edition: 'Paperback Edition',
    year: 2016,
    isbn: '978-1-40-883999-7',
    track: 'History & Economics',
    summary:
      'Recenters world history on the Eurasian corridors connecting East and West—tracing how trade routes, religions, silver, oil, and empires shifted global power.',
    url: 'https://www.bloomsbury.com/uk/discover/non-fiction-features/the-silk-roads-by-peter-frankopan/',
    topics: [
      'Eurasian trade corridors & cross-cultural transmission',
      'Spread of religions, manuscripts & commercial law',
      'Steppe empires, Mongol connectivity & plague shocks',
      'Maritime shift, silver flows & imperial competition',
      'Energy geopolitics & modern Eurasian realignment',
    ],
  },
  {
    slug: 'what-is-history',
    title: 'What Is History?',
    spineTitle: 'What Is History?',
    authors: 'E. H. Carr',
    spineAuthor: 'CARR',
    publisher: 'Penguin Classics',
    edition: '2nd Edition',
    year: 2018,
    isbn: '978-0-24-135190-1',
    track: 'History & Economics',
    summary:
      'Scrutinizes how historians select facts, frame causation, and write from their own era—essential tools for reading historical narratives critically.',
    url: 'https://www.penguin.co.uk/books/13521/what-is-history-by-carr-e-h/9780241351901',
    topics: [
      'The historian and their facts: selection vs neutrality',
      'Individuals vs structural social forces',
      'Historical causation & counterfactual reasoning',
      'Objectivity, perspective & changing interpretations',
      'How the present reshapes our reading of the past',
    ],
  },
  {
    slug: 'the-economy-2',
    title: 'The Economy 2.0',
    spineTitle: 'The Economy 2.0',
    authors: 'The CORE Econ Team',
    spineAuthor: 'CORE ECON',
    publisher: 'CORE Econ / Oxford University Press',
    edition: '2nd Edition (Micro & Macro)',
    year: 2023,
    isbn: '978-0-19-881024-7',
    track: 'History & Economics',
    summary:
      'An open-access modern economics curriculum grounded in empirical data, strategic interaction, labor markets, bargaining power, and macro policy.',
    url: 'https://books.core-econ.org/the-economy/index.html',
    topics: [
      'Scarcity, opportunity cost & technological innovation',
      'Game theory, social dilemmas & bargaining power',
      'Firms, labor contracts & market competition',
      'Market failures, externalities & public goods',
      'Credit, inflation, unemployment & fiscal/monetary policy',
    ],
  },
  {
    slug: 'the-undercover-economist',
    title: 'The Undercover Economist',
    spineTitle: 'The Undercover Economist',
    authors: 'Tim Harford',
    spineAuthor: 'HARFORD',
    publisher: 'Random House / Oxford University Press',
    edition: 'Revised Edition',
    year: 2012,
    isbn: '978-0-34-549401-6',
    track: 'History & Economics',
    summary:
      'Uses everyday scenes—coffee shops, supermarkets, traffic, and healthcare—to unpack scarcity rents, price discrimination, externalities, and asymmetric information.',
    url: 'https://timharford.com/books/undercovereconomist/',
    topics: [
      'Scarcity power, land rents & location pricing',
      'Price targeting & hidden versioning strategies',
      'Externalities, congestion pricing & market efficiency',
      'Asymmetric information, adverse selection & moral hazard',
      'Globalization, trade & institutional development',
    ],
  },
  {
    slug: 'poor-economics',
    title: 'Poor Economics: A Radical Rethinking of the Way to Fight Global Poverty',
    spineTitle: 'Poor Economics',
    authors: 'Abhijit V. Banerjee & Esther Duflo',
    spineAuthor: 'BANERJEE & DUFLO',
    publisher: 'PublicAffairs',
    edition: 'Paperback Edition',
    year: 2012,
    isbn: '978-1-54-170618-7',
    track: 'History & Economics',
    summary:
      'Uses randomized field experiments to investigate the concrete incentives, credit constraints, health traps, and institutional details shaping life in poverty.',
    url: 'https://www.hachettebookgroup.com/titles/abhijit-v-banerjee/poor-economics/9781541706187/',
    topics: [
      'Randomized controlled trials in development economics',
      'Poverty traps vs incremental human-capital gains',
      'Preventive health, nudges & last-mile delivery',
      'Microcredit, savings constraints & risk exposure',
      'Governance, local accountability & policy design',
    ],
  },

  // ── Power & Institutions (Politics, Law & Institutions, International Relations) ───────
  {
    slug: 'politics-heywood',
    title: 'Politics',
    spineTitle: 'Politics',
    authors: 'Andrew Heywood & Matthew Laing',
    spineAuthor: 'HEYWOOD & LAING',
    publisher: 'Bloomsbury Academic',
    edition: '6th Edition',
    year: 2025,
    isbn: '978-1-35-035682-5',
    track: 'Power & Institutions',
    summary:
      'A comprehensive introduction to political science covering power, ideologies, states, constitutions, elections, parties, bureaucracies, and comparative government.',
    url: 'https://www.bloomsbury.com/us/politics-9781350356825/',
    topics: [
      'Concepts of power, authority & political legitimacy',
      'Major political ideologies & competing traditions',
      'State formation, sovereignty & regime types',
      'Electoral systems, party competition & coalitions',
      'Executives, legislatures, courts & bureaucracies',
    ],
  },
  {
    slug: 'political-philosophy-vsi',
    title: 'Political Philosophy: A Very Short Introduction',
    spineTitle: 'Political Philosophy',
    authors: 'David Miller',
    spineAuthor: 'MILLER',
    publisher: 'Oxford University Press',
    edition: '1st Edition',
    year: 2003,
    isbn: '978-0-19-280395-5',
    track: 'Power & Institutions',
    summary:
      'A compact survey of core political philosophy: why political authority is justified, how democracy works, and how liberty, equality, and membership collide.',
    url: 'https://academic.oup.com/book/880',
    topics: [
      'Political authority & grounds for obedience',
      'Democratic representation & majority limits',
      'Negative vs positive freedom & rights',
      'Social justice, desert & egalitarianism',
      'Citizenship, pluralism & global obligations',
    ],
  },
  {
    slug: 'the-origins-of-political-order',
    title: 'The Origins of Political Order: From Prehuman Times to the French Revolution',
    spineTitle: 'Origins of Political Order',
    authors: 'Francis Fukuyama',
    spineAuthor: 'FUKUYAMA',
    publisher: 'Farrar, Straus and Giroux',
    edition: 'Paperback Edition',
    year: 2012,
    isbn: '978-0-37-453322-9',
    track: 'Power & Institutions',
    summary:
      'A comparative historical argument showing how modern political order rests on three distinct pillars: a capable state, the rule of law, and accountable government.',
    url: 'https://fukuyama.people.stanford.edu/originsofpoliticalorder',
    topics: [
      'Kinship-based bands to impersonal state bureaucracy',
      'Early Chinese state capacity & meritocratic exams',
      'Rule of law rooted in religious & legal autonomy',
      'Representative assemblies & executive accountability',
      'Institutional decay & patrimonial capture',
    ],
  },
  {
    slug: 'the-rule-of-law',
    title: 'The Rule of Law',
    spineTitle: 'The Rule of Law',
    authors: 'Tom Bingham',
    spineAuthor: 'BINGHAM',
    publisher: 'Penguin Books',
    edition: 'Paperback Edition',
    year: 2011,
    isbn: '978-0-14-103453-9',
    track: 'Power & Institutions',
    summary:
      'A clear, practical breakdown of the eight principles that restrain arbitrary power, guarantee equal legal protection, and keep governments accountable under law.',
    url: 'https://www.penguin.co.uk/books/56375/the-rule-of-law-by-tom-bingham/9780141034539',
    topics: [
      'Accessible, predictable & publicly legible law',
      'Law over discretion in executive action',
      'Equality before the law & independent courts',
      'Fair trials, due process & human-rights protections',
      'Compliance with international legal obligations',
    ],
  },
  {
    slug: 'law-vsi',
    title: 'Law: A Very Short Introduction',
    spineTitle: 'Law (VSI)',
    authors: 'Raymond Wacks',
    spineAuthor: 'WACKS',
    publisher: 'Oxford University Press',
    edition: '3rd Edition',
    year: 2023,
    isbn: '978-0-19-874562-4',
    track: 'Power & Institutions',
    summary:
      'Introduces how legal systems function—common law vs civil law, courts, contracts, torts, criminal justice, and the persistent tension between legality and justice.',
    url: 'https://academic.oup.com/book/46428',
    topics: [
      'Legal traditions: common law vs civil law systems',
      'Courts, precedent & statutory interpretation',
      'Core branches: constitutional, contract, tort & criminal',
      'Rights, remedies & legal personhood',
      'Law, morality & institutional reform',
    ],
  },
  {
    slug: 'seeing-like-a-state',
    title: 'Seeing Like a State: How Certain Schemes to Improve the Human Condition Have Failed',
    spineTitle: 'Seeing Like a State',
    authors: 'James C. Scott',
    spineAuthor: 'SCOTT',
    publisher: 'Yale University Press',
    edition: 'Veritas Paperback Edition',
    year: 2020,
    isbn: '978-0-30-024675-9',
    track: 'Power & Institutions',
    summary:
      'Shows why top-down modernist planning schemes fail when states enforce simplified legibility and metrics while erasing practical local knowledge (mētis).',
    url: 'https://yalebooks.yale.edu/book/9780300246759/seeing-like-a-state/',
    topics: [
      'State legibility: surnames, cadastral maps & standard metrics',
      'Scientific forestry & monoculture fragility',
      'High-modernist urban planning vs organic cities',
      'Authoritarian capacity combined with weak civil society',
      'Mētis: practical local knowledge vs formal blueprints',
    ],
  },
  {
    slug: 'the-globalization-of-world-politics',
    title: 'The Globalization of World Politics: An Introduction to International Relations',
    spineTitle: 'Globalization of World Politics',
    authors: 'John Baylis, Steve Smith & Patricia Owens (eds.)',
    spineAuthor: 'BAYLIS ET AL.',
    publisher: 'Oxford University Press',
    edition: '9th Edition',
    year: 2023,
    isbn: '978-0-19-289814-2',
    track: 'Power & Institutions',
    summary:
      'A comprehensive survey of international relations theories—realism, liberalism, constructivism, and critical perspectives—applied to security, trade, and global governance.',
    url: 'https://www.oup.com.au/books/higher-education/politics/9780192898142',
    topics: [
      'Realism, liberalism & constructivism in world politics',
      'Sovereignty, balance of power & security dilemmas',
      'International political economy & trade regimes',
      'International organizations, diplomacy & law',
      'Transnational risks: climate, conflict & migration',
    ],
  },
  {
    slug: 'international-relations-vsi',
    title: 'International Relations: A Very Short Introduction',
    spineTitle: 'International Relations',
    authors: 'Christian Reus-Smit',
    spineAuthor: 'REUS-SMIT',
    publisher: 'Oxford University Press',
    edition: '1st Edition',
    year: 2020,
    isbn: '978-0-19-885021-2',
    track: 'Power & Institutions',
    summary:
      'A crisp introduction to how international political order emerged historically, how sovereign states coexist with global norms, and how legitimacy shapes geopolitics.',
    url: 'https://academic.oup.com/book/32697',
    topics: [
      'Historical evolution of sovereign state systems',
      'Empires, decolonization & globalizing order',
      'Norms, legitimacy & institutional authority',
      'Great-power rivalry vs multilateral diplomacy',
      'Culture, identity & ordering global diversity',
    ],
  },
  {
    slug: 'after-hegemony',
    title: 'After Hegemony: Cooperation and Discord in the World Political Economy',
    spineTitle: 'After Hegemony',
    authors: 'Robert O. Keohane',
    spineAuthor: 'KEOHANE',
    publisher: 'Princeton University Press',
    edition: 'Classic Edition',
    year: 2005,
    isbn: '978-0-69-112248-9',
    track: 'Power & Institutions',
    summary:
      'A foundational theoretical work showing how international regimes and institutions lower transaction costs, share information, and sustain cooperation without a single hegemon.',
    url: 'https://press.princeton.edu/books/paperback/9780691122489/after-hegemony',
    topics: [
      'Neoliberal institutionalism vs hegemonic stability',
      'Why rational states build international regimes',
      'Reducing transaction costs & information asymmetry',
      'Reciprocity, reputation & iterated compliance',
      'Trade, monetary & energy cooperation under multipolarity',
    ],
  },
];

/** Builds continuously numbered `BookItem` records starting after `startStage` / `startTopicNumber`. */
export function buildHumanitiesBooks(startStage: number, startTopicNumber: number): BookItem[] {
  let topicNum = startTopicNumber;
  return RAW_HUMANITIES_BOOKS.map((raw, idx) => {
    const stage = startStage + idx;
    const topics = raw.topics.map((title) => ({ number: topicNum++, title }));
    return {
      slug: raw.slug,
      stage,
      stageLabel: String(stage).padStart(2, '0'),
      title: raw.title,
      spineTitle: raw.spineTitle,
      authors: raw.authors,
      spineAuthor: raw.spineAuthor,
      publisher: raw.publisher,
      edition: raw.edition,
      year: raw.year,
      isbn: raw.isbn,
      track: raw.track,
      status: 'queued',
      summary: raw.summary,
      coverSrc: `/assets/bookshelf/${raw.slug}.webp`,
      url: raw.url,
      spine: getLiveConsoleSpineTheme(stage - 1),
      topics,
    };
  });
}
