import { Link } from 'react-router-dom'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  DocumentIcon,
  FamilyVaultIcon,
  LogoIcon,
  MedicalDataIcon,
  MedicineIcon,
  SafetyCheckIcon,
} from '../components/Icons'

const features = [
  {
    icon: FamilyVaultIcon,
    title: 'Family Health Vault',
    description: 'Keep documents, conditions, allergies, and medications organized for everyone you care for.',
  },
  {
    icon: SafetyCheckIcon,
    title: 'AI-Powered Safety Checks',
    description: 'Review medicines against each family member’s health profile, allergy history, and current medications.',
  },
  {
    icon: MedicalDataIcon,
    title: 'Built on Real Medical Data',
    description: 'Medication details are grounded in openFDA labels and RxNorm data, not generic guesswork.',
  },
]

const steps = [
  {
    icon: FamilyVaultIcon,
    title: 'Add family members',
    description: 'Create a clear health profile for each person under your care.',
  },
  {
    icon: DocumentIcon,
    title: 'Upload records or search a medicine',
    description: 'Bring in important documents or look up a medicine in seconds.',
  },
  {
    icon: SafetyCheckIcon,
    title: 'Get a personalized safety verdict',
    description: 'See practical cautions shaped by that person’s information.',
  },
]

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-label="MediLens safety assessment preview">
      <div className="absolute -inset-5 rounded-[2.5rem] bg-blue-300/30 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-950/15 sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white">
              <LogoIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-slate-900">MediLens</p>
              <p className="text-[11px] font-medium text-slate-400">Family health overview</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-700">PROFILE ACTIVE</span>
        </div>

        <div className="grid gap-3 pt-4 sm:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-extrabold text-blue-700">MC</div>
              <div>
                <p className="text-sm font-bold text-slate-900">Maya Chen</p>
                <p className="text-xs text-slate-500">Health profile complete</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1.5 flex justify-between text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <span>Current medications</span><span>2</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">Lisinopril</span>
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">Warfarin</span>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Known allergy</p>
                <span className="inline-flex rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">Penicillin</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Safety assessment</p>
                <p className="mt-1 text-xl font-extrabold tracking-tight text-amber-900">CAUTION</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <MedicineIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-amber-900/80">Review this medication with a clinician or pharmacist before use alongside the current profile.</p>
            <div className="mt-4 border-t border-amber-200 pt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> PERSONALIZED REVIEW
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-800">
          <CheckCircleIcon className="h-4 w-4 shrink-0" />
          Built from the health details you have on file.
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-blue-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg text-lg font-extrabold tracking-tight text-blue-700 outline-none transition-colors hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:text-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-md shadow-blue-200">
              <LogoIcon className="h-5 w-5" />
            </span>
            MediLens
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Account actions">
            <Link to="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-bold text-blue-700 outline-none transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-4">
              Sign In
            </Link>
            <Link to="/login?mode=demo" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-3 text-sm font-bold text-white shadow-md shadow-blue-200 outline-none transition-all hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:px-4">
              Try Demo
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
          <div className="absolute left-1/2 top-0 -z-10 h-96 w-[44rem] -translate-x-1/2 rounded-full bg-blue-200/35 blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 sm:py-24 md:grid-cols-[1.05fr_0.95fr] md:py-28 lg:px-8 lg:py-32">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-bold tracking-wide text-blue-800 shadow-sm">
                <SafetyCheckIcon className="h-4 w-4" /> PERSONALIZED FAMILY MEDICATION SAFETY
              </div>
              <h1 className="mt-6 text-4xl font-extrabold tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.04]">
                Never miss a dangerous drug interaction again.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
                MediLens brings family health records and AI-powered medication safety checks together for a personalized view of every person you care for.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/login?mode=demo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-200 outline-none transition-all hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                  Try Demo <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-200 bg-white px-5 text-sm font-bold text-blue-700 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                  Sign In
                </Link>
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><CheckCircleIcon className="h-4 w-4 text-blue-600" /> No signup required for the demo.</p>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="why-medilens" className="scroll-mt-24 bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">A safer view of family health</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">One place for the details that make medication decisions personal.</h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <article key={title} className="group rounded-2xl border border-blue-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition-colors group-hover:bg-blue-700 group-hover:text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold tracking-tight text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">How it works</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">A clearer path from records to reassurance.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">Set up the essentials once, then make each medicine search more relevant to the person in front of you.</p>
            </div>
            <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              <div className="absolute left-[17%] right-[17%] top-7 hidden h-px bg-blue-200 md:block" aria-hidden="true" />
              {steps.map(({ icon: Icon, title, description }, index) => (
                <article key={title} className="relative text-center">
                  <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-blue-700 text-white shadow-lg shadow-blue-200">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="mt-5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-50 px-2 text-xs font-extrabold text-blue-700">0{index + 1}</span>
                  <h3 className="mt-3 text-lg font-extrabold tracking-tight text-slate-900">{title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-blue-100 bg-blue-50 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-4 text-center sm:flex-row sm:gap-8 sm:px-6 lg:px-8">
            <p className="text-sm font-bold text-slate-600">Powered by trusted health and AI data sources</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-extrabold tracking-tight text-slate-500">
              <span>Google Gemini</span>
              <span className="text-blue-300" aria-hidden="true">•</span>
              <span>openFDA</span>
              <span className="text-blue-300" aria-hidden="true">•</span>
              <span>RxNorm</span>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-blue-700 px-6 py-14 text-center text-white shadow-xl shadow-blue-200 sm:px-10 sm:py-16">
            <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-cyan-300/20 blur-2xl" />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-100">See the difference context makes</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Give every family member a safer medication check.</h2>
              <p className="mt-4 text-base leading-7 text-blue-100">Explore the read-only demo to see how records and safety guidance come together.</p>
              <Link to="/login?mode=demo" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-blue-700 shadow-lg outline-none transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700">
                Try Demo <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <p className="mt-4 text-sm text-blue-100">No signup required for the demo.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 py-10 text-slate-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
              <LogoIcon className="h-5 w-5 text-blue-300" /> MediLens
            </div>
            <p className="mt-2 text-sm text-slate-400">A healthtech project for clearer family medication decisions.</p>
          </div>
          <div className="text-sm text-slate-400 md:text-right">
            <p>Not medical advice. Always consult a qualified healthcare professional.</p>
            <p className="mt-1 text-xs text-slate-500">MediLens · Family health safety</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
