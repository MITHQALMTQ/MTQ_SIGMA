"use client";

// MTQΣ landing — top navigation (v7.2 reference parity · working tabs).
// Reference composition: MTQΣ badge + wordmark · Home/Product/Ecosystem/
// Developers/Governance/Resources links (Home active) · green-dot chain
// selector · gradient "Connect Wallet" pill.
//
// TAB FIX (owner directive): Developers / Governance / Resources were thin
// status dialogs that led nowhere. They are now REAL dropdown menus — each
// item launches the Pilot Command Center at its matching section (every
// target is a real terminal screen, nothing fabricated). The honest status
// register dialog remains available inside each menu ("Status register").
// The chain selector is now a real popover (3 testnets + Networks link)
// instead of a dead button.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, ChevronDown, Rocket, Wallet, ClipboardCheck, ArrowUpRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandMark } from "./BrandMark";
import { OPERATIONAL_STATUS } from "@/lib/mtq/landing-status";
import { WalletDialog, InfoDialog } from "./StatusDialogs";

const ANCHOR_ITEMS = [
  { id: "home", label: "Home" },
  { id: "product", label: "Product" },
  { id: "ecosystem", label: "Ecosystem" },
] as const;

/* One launch item inside a nav menu. `section` must be a real terminal
   SectionId — the terminal restores it from sessionStorage on mount. */
type MenuItem =
  | { kind: "launch"; label: string; hint: string; section: string }
  | { kind: "dialog"; label: string; hint: string; which: "developers" | "governance" | "resources" };

type NavMenu = {
  which: "developers" | "governance" | "resources";
  label: string;
  items: MenuItem[];
};

/* All targets are REAL terminal sections (verified in the router):
   contracts · networks · developers · governance · transparency · security ·
   docs · architecture · validation · evidence. */
const NAV_MENUS: NavMenu[] = [
  {
    which: "developers",
    label: "Developers",
    items: [
      { kind: "launch", label: "Contract Registry", hint: "3 testnets, canonical addresses", section: "contracts" },
      { kind: "launch", label: "Testnet Networks", hint: "Chains · RPC · explorers · oracles", section: "networks" },
      { kind: "launch", label: "Developer Reference & API", hint: "40 read-only endpoints + verification", section: "developers" },
      { kind: "dialog", label: "Status register", hint: "Deployment & test evidence summary", which: "developers" },
    ],
  },
  {
    which: "governance",
    label: "Governance",
    items: [
      { kind: "launch", label: "Governance — 4 Councils", hint: "State machine · councils · gates", section: "governance" },
      { kind: "launch", label: "Transparency", hint: "Reproducibility & publication", section: "transparency" },
      { kind: "launch", label: "Security", hint: "Posture · keys · audit · Safe status", section: "security" },
      { kind: "dialog", label: "Status register", hint: "Gate-by-gate honest status", which: "governance" },
    ],
  },
  {
    which: "resources",
    label: "Resources",
    items: [
      { kind: "launch", label: "Documentation", hint: "Master blueprint v1.0 chapters", section: "docs" },
      { kind: "launch", label: "Architecture", hint: "Final declarations & two-engine hierarchy", section: "architecture" },
      { kind: "launch", label: "Validation & Research", hint: "§23 stress matrix, live verdicts", section: "validation" },
      { kind: "launch", label: "Evidence Package", hint: "§1 restrictions · findings · re-runs", section: "evidence" },
      { kind: "dialog", label: "Status register", hint: "Evidence package D-1…D-6", which: "resources" },
    ],
  },
];

const TONE_DOT: Record<string, string> = {
  cyan: "bg-teal-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

/* Shared link styling (nav + mobile sheet). */
const linkCls = (isActive: boolean) =>
  `rounded-lg px-3 py-2 text-[0.9rem] font-medium transition ${
    isActive ? "bg-[#E7F4F1] text-[#0F766E]" : "text-[#4A5C56] hover:bg-[#F0F7F4] hover:text-[#0E1F1B]"
  }`;

/* The three live testnets (verbatim registry facts — read-only verified; the
   same registry that serves /api/contracts). */
const TESTNETS = [
  { label: "Monad Testnet", chainId: "10143", note: "9 contracts + wallet, code verified" },
  { label: "Arc Testnet", chainId: "5042002", note: "9 contracts, native USDC (18 dec)" },
  { label: "Solana Devnet", chainId: "devnet", note: "SPL mint GAGRdrY6…, decimals 18" },
] as const;

export function LandingNav({
  onLaunch,
  onLaunchTo,
}: {
  onLaunch?: () => void;
  /** Launch the terminal directly at a specific section (real screens only). */
  onLaunchTo?: (section: string) => void;
}) {
  const [active, setActive] = useState<string>("home");
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<NavMenu["which"] | null>(null);
  const [dialog, setDialog] = useState<NavMenu["which"] | null>(null);
  const [chainOpen, setChainOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Close any open dropdown when clicking outside the nav or pressing Escape. */
  useEffect(() => {
    if (!openMenu && !chainOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) {
        setOpenMenu(null);
        setChainOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setChainOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenu, chainOpen]);

  useEffect(() => {
    const sections = ANCHOR_ITEMS.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);


  const pickLaunch = (section: string) => {
    setOpenMenu(null);
    setChainOpen(false);
    onLaunchTo?.(section);
  };

  return (
    <header className="lp-nav" data-scrolled={scrolled}>
      <nav
        ref={navRef}
        className="relative mx-auto flex h-[4.4rem] w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 xl:px-10"
        aria-label="Primary navigation"
      >
        {/* brand */}
        <a href="#home" className="flex shrink-0 items-center gap-2.5" aria-label="MTQΣ — back to top">
          <BrandMark size={34} className="shrink-0" />
          <span
            className="text-[1.12rem] font-extrabold tracking-[0.04em] text-[#0E1F1B]"
            style={{ fontFamily: "var(--font-mtqs-display), Montserrat, sans-serif" }}
          >
            MTQΣ
          </span>
        </a>

        {/* desktop links + working dropdown menus */}
        <ul className="hidden items-center gap-8 lg:flex">
          {ANCHOR_ITEMS.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="lp-nav-link" data-active={active === item.id}>
                {item.label}
              </a>
            </li>
          ))}
          {NAV_MENUS.map((menu) => (
            <li key={menu.which} className="relative">
              <button
                type="button"
                className="lp-nav-link inline-flex items-center gap-1"
                aria-haspopup="menu"
                aria-expanded={openMenu === menu.which}
                onClick={() => {
                  setOpenMenu((cur) => (cur === menu.which ? null : menu.which));
                  setChainOpen(false);
                }}
              >
                {menu.label}
                <ChevronDown
                  className={`size-3 transition-transform ${openMenu === menu.which ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {openMenu === menu.which && (
                <div className="lp-nav-menu" role="menu" aria-label={`${menu.label} menu`}>
                  {menu.items.map((item) =>
                    item.kind === "launch" ? (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        className="lp-nav-menu-item"
                        onClick={() => pickLaunch(item.section)}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-[#0E1F1B]">
                            {item.label}
                            <ArrowUpRight className="size-3 shrink-0 text-[#0D9488]" aria-hidden />
                          </span>
                          <span className="mt-0.5 block truncate text-[0.66rem] text-[#5B6E68]">
                            {item.hint}
                          </span>
                        </span>
                      </button>
                    ) : (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        className="lp-nav-menu-item"
                        onClick={() => {
                          setOpenMenu(null);
                          setDialog(item.which);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-[#0E1F1B]">
                            <ClipboardCheck className="size-3.5 shrink-0 text-[#0D9488]" aria-hidden />
                            {item.label}
                          </span>
                          <span className="mt-0.5 block truncate text-[0.66rem] text-[#5B6E68]">
                            {item.hint}
                          </span>
                        </span>
                      </button>
                    ),
                  )}
                  <p className="lp-nav-menu-foot">
                    Launch items open the Pilot Command Center · TESTNET ONLY · SHADOW MODE
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* right cluster — launch app + chain popover + Connect Wallet */}
        <div className="flex items-center gap-3">
          {onLaunch ? (
            <button
              type="button"
              className="lp-btn-launch hidden sm:inline-flex"
              onClick={onLaunch}
              aria-label="Launch the MTQΣ Pilot Command Center (testnet pilot terminal)"
            >
              <Rocket className="size-4" aria-hidden />
              Launch App
            </button>
          ) : null}

          {/* chain selector — real popover (was a dead button) */}
          <div className="relative hidden md:block">
            <button
              type="button"
              className="lp-chain-pill"
              title="Pilot environment: live testnets — see the Networks tab in the terminal"
              aria-label="Pilot environment: live testnets"
              aria-haspopup="menu"
              aria-expanded={chainOpen}
              onClick={() => {
                setChainOpen((v) => !v);
                setOpenMenu(null);
              }}
            >
              <span className="lp-chain-dot" aria-hidden />
              {/* 24-e-2: the static face previously read "Monad Testnet" (implying
                  one selected network) while the popover honestly lists all 3
                  testnets — the face now summarizes, sized down slightly to keep
                  the pill layout safe on md screens. */}
              <span className="whitespace-nowrap text-[0.68rem] xl:text-[0.78rem]">
                3 Testnets Live
              </span>
              <ChevronDown
                className={`size-3.5 text-[#5B6E68] transition-transform ${chainOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {chainOpen && (
              <div className="lp-nav-menu" role="menu" aria-label="Pilot environments">
                <p className="px-3.5 pt-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#7A8C86]">
                  Live pilot testnets · read-only verified
                </p>
                {TESTNETS.map((t) => (
                  <div key={t.label} className="lp-nav-menu-item cursor-default">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-[#0E1F1B]">
                        <span className="size-1.5 rounded-full bg-teal-500" aria-hidden />
                        {t.label}
                        <span className="font-mono text-[0.62rem] text-[#0F766E]">cid {t.chainId}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[0.66rem] text-[#5B6E68]">{t.note}</span>
                    </span>
                  </div>
                ))}
                {onLaunchTo ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="lp-nav-menu-item"
                    onClick={() => pickLaunch("networks")}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-[#0E1F1B]">
                        Open Networks in the terminal
                        <ArrowUpRight className="size-3 shrink-0 text-[#0D9488]" aria-hidden />
                      </span>
                      <span className="mt-0.5 block truncate text-[0.66rem] text-[#5B6E68]">
                        Full registry: 3 testnets (Monad · Arc · Solana devnet)
                      </span>
                    </span>
                  </button>
                ) : null}
                <p className="lp-nav-menu-foot">
                  No production network is selected · reserve trading not authorized
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            className="lp-btn-wallet hidden sm:inline-flex"
            aria-haspopup="dialog"
            onClick={() => setWalletOpen(true)}
          >
            <Wallet className="size-4" aria-hidden />
            Connect Wallet
          </button>
          <WalletDialog open={walletOpen} onOpenChange={setWalletOpen} />

          {/* mobile drawer trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="grid size-10 place-items-center rounded-lg border border-[#DCE5E0] bg-white text-[#33544C] shadow-sm lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" aria-hidden />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[320px] overflow-y-auto border-[#E3EAE6] bg-white text-[#0E1F1B]"
            >
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2.5 text-left">
                  <BrandMark size={26} className="shrink-0" />
                  MTQΣ
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Mobile navigation with links to every landing-page section, working
                  menu tabs that launch the terminal, and the mandatory operational
                  status statements.
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="mt-2 flex flex-col">
                {ANCHOR_ITEMS.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={() => setOpen(false)}
                    className={linkCls(active === item.id)}
                  >
                    {item.label}
                  </a>
                ))}

                {/* working menus — expandable launch lists */}
                {NAV_MENUS.map((menu) => (
                  <MobileMenuGroup
                    key={menu.which}
                    menu={menu}
                    onLaunchTo={onLaunchTo}
                    onOpenDialog={(which) => {
                      setOpen(false);
                      setDialog(which);
                    }}
                  />
                ))}

                <div className="mt-4 border-t border-[#E3EAE6] pt-4">
                  {onLaunch ? (
                    <button
                      type="button"
                      className="lp-btn-primary mb-4 w-full !h-11 !justify-center"
                      onClick={() => {
                        setOpen(false);
                        onLaunch();
                      }}
                    >
                      <Rocket className="size-4" aria-hidden />
                      Launch Pilot Command Center
                    </button>
                  ) : null}
                  <p className="mb-2 px-3 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#7A8C86]">
                    Operational status
                  </p>
                  <ul className="flex flex-col gap-2 px-3">
                    {OPERATIONAL_STATUS.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-[0.68rem] font-semibold text-[#33544C]">
                        <span className={`size-1.5 rounded-full ${TONE_DOT[s.tone]}`} aria-hidden />
                        {s.title}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="lp-btn-wallet mt-5 w-full !justify-center"
                    onClick={() => {
                      setOpen(false);
                      setWalletOpen(true);
                    }}
                  >
                    <Wallet className="size-4" aria-hidden />
                    Connect Wallet
                  </button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Honest status-register dialogs (shared by all three menus) */}
      {NAV_MENUS.map((m) => (
        <InfoDialog key={m.which} which={m.which} open={dialog === m.which} onOpenChange={(o) => !o && setDialog(null)} />
      ))}
    </header>
  );
}

/* Expandable menu group inside the mobile sheet — every item launches the
   terminal at a real section, plus the honest status register. */
function MobileMenuGroup({
  menu,
  onLaunchTo,
  onOpenDialog,
}: {
  menu: NavMenu;
  onLaunchTo?: (section: string) => void;
  onOpenDialog: (which: NavMenu["which"]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        className={linkCls(false) + " !justify-between w-full flex"}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-1">
          {menu.label}
          <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>
      {expanded && (
        <div className="mt-1 ml-3 flex flex-col gap-1 border-l border-[#E3EAE6] pl-3">
          {menu.items.map((item) =>
            item.kind === "launch" ? (
              <button
                key={item.label}
                type="button"
                className="rounded-lg px-3 py-2 text-left text-[0.82rem] font-medium text-[#33544C] transition hover:bg-[#F0F7F4] hover:text-[#0E1F1B]"
                onClick={() => onLaunchTo?.(item.section)}
              >
                <span className="flex items-center gap-1.5">
                  {item.label}
                  <ArrowUpRight className="size-3 shrink-0 text-[#0D9488]" aria-hidden />
                </span>
                <span className="mt-0.5 block text-[0.64rem] text-[#7A8C86]">{item.hint}</span>
              </button>
            ) : (
              <button
                key={item.label}
                type="button"
                className="rounded-lg px-3 py-2 text-left text-[0.82rem] font-medium text-[#33544C] transition hover:bg-[#F0F7F4] hover:text-[#0E1F1B]"
                onClick={() => onOpenDialog(item.which)}
              >
                <span className="flex items-center gap-1.5">
                  <ClipboardCheck className="size-3.5 shrink-0 text-[#0D9488]" aria-hidden />
                  {item.label}
                </span>
                <span className="mt-0.5 block text-[0.64rem] text-[#7A8C86]">{item.hint}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
