import Link from "next/link";
export default function Header(){return <header className="navy sticky top-0 z-30 shadow-lg"><div className="wrap flex min-h-[82px] items-center gap-5 py-3">
<Link href="/" className="flex items-center gap-2 font-black text-2xl leading-tight"><span className="text-4xl">🎓</span><span>Study<span className="text-yellow-300">Hub</span><small className="block text-xs font-medium tracking-wide text-blue-100">Learn · Practice · Excel</small></span></Link>
<nav className="desktop-nav ml-auto flex items-center gap-5 text-sm font-semibold"><a href="/">Home</a><a href="#resources">Courses</a><a href="#resources">Study Material</a><a href="#resources">Resources</a><a href="#about">About</a><a href="#contact">Contact</a></nav>
<form action="/#resources" className="desktop-nav flex rounded-full bg-white p-1"><input name="q" placeholder="Search here..." className="w-32 rounded-full px-3 text-sm text-slate-900 outline-none"/><button className="px-2 text-slate-900" aria-label="Search">⌕</button></form>
<Link href="/library" className="btn btn-primary whitespace-nowrap text-sm">Login / My Library</Link>
</div></header>}