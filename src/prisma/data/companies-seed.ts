export interface CompanySeedData {
  name: string
  tagline: string
  industry: string
  stage: string
  hue: number
  hiringSignal: string
  description: string
  website: string
  location: string
  size: string
  cultureValues: Array<{ title: string; description: string }>
  employerEmail: string
  employerName: string
}

export const companiesData = [
  {
    name: "Ledgerline",
    tagline: "Financial infrastructure for the next era",
    industry: "fintech",
    stage: "series-b",
    hue: 210,
    hiringSignal: "active",
    description:
      "Building the financial infrastructure layer that powers modern businesses. From payment processing to treasury management, Ledgerline provides the tools startups and enterprises need to move money efficiently across borders.",
    website: "ledgerline.io",
    location: "Amsterdam, Netherlands",
    size: "45-80",
    cultureValues: [
      { title: "Innovation", description: "We challenge financial conventions" },
      { title: "Trust", description: "Security is non-negotiable" },
      { title: "Craft", description: "Details define our product" },
    ],
    employerEmail: "employer@firstlight.io",
    employerName: "Sarah Chen",
  },
  {
    name: "Plume Pay",
    tagline: "Payments that flow like water",
    industry: "fintech",
    stage: "seed",
    hue: 175,
    hiringSignal: "expanding",
    description:
      "Reimagining how money moves between people and businesses. Plume Pay delivers invisible, frictionless payment experiences that adapt to the way users naturally transact.",
    website: "plumepay.com",
    location: "San Francisco, CA",
    size: "10-25",
    cultureValues: [
      { title: "Simplicity", description: "Complexity is the enemy" },
      { title: "Speed", description: "Move fast, learn faster" },
      { title: "Empathy", description: "Users first, always" },
    ],
    employerEmail: "marcus@firstlight.io",
    employerName: "Marcus Webb",
  },
  {
    name: "Verdant Grid",
    tagline: "Powering the clean energy transition",
    industry: "climate",
    stage: "series-a",
    hue: 145,
    hiringSignal: "active",
    description:
      "Intelligent grid management software that accelerates the adoption of renewable energy. Verdant Grid optimizes energy distribution, reduces waste, and makes clean power economically viable at scale.",
    website: "verdantgrid.com",
    location: "Berlin, Germany",
    size: "25-50",
    cultureValues: [
      { title: "Impact", description: "Every line of code fights climate change" },
      { title: "Rigor", description: "Data drives our decisions" },
      { title: "Collaboration", description: "Cross-functional by default" },
    ],
    employerEmail: "elena@firstlight.io",
    employerName: "Elena Torres",
  },
  {
    name: "Solstice Materials",
    tagline: "Engineering sustainable materials at scale",
    industry: "climate",
    stage: "growth",
    hue: 35,
    hiringSignal: "quiet",
    description:
      "Developing next-generation sustainable materials through computational chemistry and advanced manufacturing. Solstice Materials replaces petroleum-based products with high-performance bio-alternatives.",
    website: "solsticematerials.com",
    location: "Copenhagen, Denmark",
    size: "80-150",
    cultureValues: [
      { title: "Sustainability", description: "Planet over profit" },
      { title: "Patience", description: "Great things take time" },
      { title: "Excellence", description: "Good enough never is" },
    ],
    employerEmail: "henrik@firstlight.io",
    employerName: "Henrik Larsen",
  },
  {
    name: "Aurelia Health",
    tagline: "Healthcare that sees the whole person",
    industry: "health",
    stage: "series-a",
    hue: 340,
    hiringSignal: "active",
    description:
      "Holistic healthcare platform that integrates physical, mental, and social determinants of health into a single patient view. Aurelia Health empowers providers with actionable insights that go beyond symptoms.",
    website: "aureliahealth.io",
    location: "Toronto, Canada",
    size: "20-40",
    cultureValues: [
      { title: "Compassion", description: "Empathy is our algorithm" },
      { title: "Privacy", description: "Patient data is sacred" },
      { title: "Innovation", description: "Bold ideas save lives" },
    ],
    employerEmail: "priya@firstlight.io",
    employerName: "Priya Sharma",
  },
  {
    name: "Kindred Labs",
    tagline: "Democratizing clinical research",
    industry: "health",
    stage: "seed",
    hue: 280,
    hiringSignal: "expanding",
    description:
      "Making clinical trials accessible to everyone by removing geographic, financial, and bureaucratic barriers. Kindred Labs connects underserved populations with research opportunities that were previously out of reach.",
    website: "kindredlabs.io",
    location: "London, UK",
    size: "8-15",
    cultureValues: [
      { title: "Curiosity", description: "Ask why, then ask why again" },
      { title: "Accessibility", description: "Research for everyone" },
      { title: "Integrity", description: "Science over shortcuts" },
    ],
    employerEmail: "james@firstlight.io",
    employerName: "James O'Brien",
  },
  {
    name: "Loomfield AI",
    tagline: "Making AI systems trustworthy and transparent",
    industry: "ai",
    stage: "series-b",
    hue: 260,
    hiringSignal: "active",
    description:
      "Enterprise AI observability and governance platform. Loomfield AI helps organizations understand, audit, and control their AI systems with full transparency into model behavior and decision paths.",
    website: "loomfield.ai",
    location: "New York, NY",
    size: "50-100",
    cultureValues: [
      { title: "Transparency", description: "Black boxes are for storage" },
      { title: "Responsibility", description: "AI safety is not optional" },
      { title: "Depth", description: "Think deeply, build carefully" },
    ],
    employerEmail: "aisha@firstlight.io",
    employerName: "Aisha Johnson",
  },
  {
    name: "Tessellate",
    tagline: "Pattern recognition for the real world",
    industry: "ai",
    stage: "growth",
    hue: 195,
    hiringSignal: "active",
    description:
      "Applied AI company transforming how industries detect patterns, predict outcomes, and automate decisions. Tessellate's models power everything from supply chain optimization to predictive maintenance across manufacturing and logistics.",
    website: "tessellate.ai",
    location: "Tokyo, Japan",
    size: "100-200",
    cultureValues: [
      { title: "Exploration", description: "Untrodden paths lead somewhere" },
      { title: "Pragmatism", description: "Ship, then iterate" },
      { title: "Unity", description: "Diverse minds, shared mission" },
    ],
    employerEmail: "kenji@firstlight.io",
    employerName: "Kenji Tanaka",
  },
  {
    name: "Marigold Studio",
    tagline: "Design that blooms from insight",
    industry: "creative",
    stage: "seed",
    hue: 45,
    hiringSignal: "expanding",
    description:
      "Boutique design studio creating brand identities, digital products, and interactive experiences that resonate. Marigold Studio blends strategic thinking with hands-on craft to build brands people remember.",
    website: "marigold.studio",
    location: "Brooklyn, NY",
    size: "5-12",
    cultureValues: [
      { title: "Playfulness", description: "Serious work, joyful process" },
      { title: "Craftsmanship", description: "Every pixel earns its place" },
      { title: "Story", description: "Design without narrative is decoration" },
    ],
    employerEmail: "zara@firstlight.io",
    employerName: "Zara Williams",
  },
  {
    name: "Nightreel",
    tagline: "Cinematic experiences for the digital age",
    industry: "creative",
    stage: "series-b",
    hue: 25,
    hiringSignal: "active",
    description:
      "Production studio at the intersection of film, gaming, and interactive media. Nightreel creates immersive cinematic experiences that blur the line between passive viewing and active participation.",
    website: "nightreel.com",
    location: "Los Angeles, CA",
    size: "40-70",
    cultureValues: [
      { title: "Vision", description: "See what others don't" },
      { title: "Collaboration", description: "Magic happens between people" },
      { title: "Excellence", description: "Almost perfect isn't" },
    ],
    employerEmail: "david@firstlight.io",
    employerName: "David Park",
  },
  {
    name: "Forgekit",
    tagline: "Tools that respect how developers actually work",
    industry: "devtools",
    stage: "seed",
    hue: 15,
    hiringSignal: "expanding",
    description:
      "Developer tools company building CLI workflows, build systems, and productivity tooling designed around real development habits. Forgekit creates tools that stay out of your way and speed up your feedback loop.",
    website: "forgekit.dev",
    location: "Remote (US)",
    size: "5-10",
    cultureValues: [
      { title: "Developer-first", description: "We build for ourselves and everyone" },
      { title: "Openness", description: "Default to open" },
      { title: "Simplicity", description: "The best tool is the one you forget is there" },
    ],
    employerEmail: "sam@firstlight.io",
    employerName: "Sam Chen",
  },
  {
    name: "Harborstack",
    tagline: "Enterprise infrastructure, startup velocity",
    industry: "devtools",
    stage: "enterprise",
    hue: 200,
    hiringSignal: "quiet",
    description:
      "Enterprise-grade infrastructure platform that delivers the reliability and compliance large organizations demand with the deployment speed and developer experience of a modern startup toolchain.",
    website: "harborstack.com",
    location: "Seattle, WA",
    size: "150-300",
    cultureValues: [
      { title: "Reliability", description: "Downtime is not a feature" },
      { title: "Scale", description: "Build for ten thousand, serve one" },
      { title: "Security", description: "Trust is earned in milliseconds" },
    ],
    employerEmail: "rachel@firstlight.io",
    employerName: "Rachel Kim",
  },
] as const satisfies readonly CompanySeedData[]
