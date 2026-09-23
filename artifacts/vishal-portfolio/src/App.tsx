import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Eye, EyeOff, ImagePlus, LogOut, Plus, Save, Trash2, X } from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
type BlockType = 'heading' | 'paragraph' | 'image' | 'multi-image' | 'two-column' | 'three-column' | 'gallery' | 'image-text' | 'text-image' | 'section-break' | 'spacer';
type Block = { id: string; type: BlockType; heading?: string; text?: string; image?: string; images?: string[]; visible: boolean; layout?: string };
type Project = { id: string; title: string; slug: string; description: string; category: string; year: string; tags: string; featured: boolean; published: boolean; order: number; cover: string; blocks: Block[] };

const artCss = (kind: string) => kind === 'fito' ? 'art-fito' : 'art-red';
const seedProjects: Project[] = [
  {
    id: 'fito', title: 'FITO', slug: 'fito', description: 'A fitness tracking experience designed to make everyday progress easier to understand and follow.', category: 'Fitness Tracking Application', year: '2024', tags: 'UI/UX · Mobile App · Prototype', featured: true, published: true, order: 1, cover: 'fito', blocks: [
      { id: 'fito-1', type: 'heading', heading: 'Making progress feel visible.', visible: true },
      { id: 'fito-2', type: 'paragraph', heading: 'Overview', text: 'FITO is a focused fitness tracking experience for everyday routines. The interface brings activity, goals, and small wins into one calm view.', visible: true },
      { id: 'fito-3', type: 'image', image: 'fito', layout: 'wide', visible: true },
      { id: 'fito-4', type: 'paragraph', heading: 'Structure before styling', text: 'I started by mapping the loop between setting a goal, checking in, and understanding what changed. The visual system follows that same simple rhythm.', visible: true },
      { id: 'fito-5', type: 'two-column', images: ['fito', 'fito'], visible: true },
    ],
  },
  {
    id: 'red-white', title: 'RED WHITE', slug: 'red-white', description: 'A food application focused on simple navigation, clear content, and an easy ordering experience.', category: 'Food Application', year: '2024', tags: 'UI/UX · Mobile App', featured: true, published: true, order: 2, cover: 'red', blocks: [
      { id: 'rw-1', type: 'heading', heading: 'A clearer route to dinner.', visible: true },
      { id: 'rw-2', type: 'paragraph', heading: 'Overview', text: 'RED WHITE explores how a food app can feel direct and welcoming. The focus is on finding something good without making the decision feel like work.', visible: true },
      { id: 'rw-3', type: 'image', image: 'red', layout: 'wide', visible: true },
      { id: 'rw-4', type: 'paragraph', heading: 'Clear content, less friction', text: 'Category browsing and item details are arranged around the questions people actually ask: what is it, what does it cost, and how soon can I have it?', visible: true },
      { id: 'rw-5', type: 'three-column', images: ['red', 'red', 'red'], visible: true },
    ],
  },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const cloneSeed = () => seedProjects.map((project) => ({ ...project, blocks: project.blocks.map((block) => ({ ...block, images: block.images ? [...block.images] : undefined })) }));

function usePortfolio() {
  const [projects, setProjectsState] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fromDatabase = (row: any): Project => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? '',
    category: row.category ?? '',
    year: row.year ?? '',
    tags: row.tags ?? '',
    featured: row.featured ?? false,
    published: row.published ?? false,
    order: row.sort_order ?? 0,
    cover: row.cover ?? '',
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
  });

  const toDatabase = (project: Project) => ({
    id: project.id,
    title: project.title,
    slug: project.slug,
    description: project.description,
    category: project.category,
    year: project.year,
    tags: project.tags,
    featured: project.featured,
    published: project.published,
    sort_order: project.order,
    cover: project.cover,
    blocks: project.blocks,
    updated_at: new Date().toISOString(),
  });

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to load projects:', error);
      setLoading(false);
      return;
    }

    // First-time migration:
    // if Supabase is empty and admin is logged in,
    // copy existing browser projects into Supabase.
    if (!data?.length) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        let existingProjects: Project[] = [];

        try {
          const saved = localStorage.getItem(
            'vishal-portfolio-projects'
          );

          existingProjects = saved
            ? JSON.parse(saved)
            : cloneSeed();
        } catch {
          existingProjects = cloneSeed();
        }

        if (existingProjects.length) {
          const { error: migrationError } = await supabase
            .from('projects')
            .upsert(existingProjects.map(toDatabase));

          if (!migrationError) {
            setProjectsState(existingProjects);
            setLoading(false);

            window.dispatchEvent(
              new Event('portfolio-updated')
            );

            return;
          }

          console.error(
            'Project migration failed:',
            migrationError
          );
        }
      }
    }

    setProjectsState((data ?? []).map(fromDatabase));
    setLoading(false);
  };

  useEffect(() => {
    loadProjects();

    const refresh = () => {
      loadProjects();
    };

    window.addEventListener('portfolio-updated', refresh);

    return () => {
      window.removeEventListener(
        'portfolio-updated',
        refresh
      );
    };
  }, []);

  const setProjects = (
    update:
      | Project[]
      | ((items: Project[]) => Project[])
  ) => {
    setProjectsState((current) => {
      const next =
        typeof update === 'function'
          ? update(current)
          : update;

      const sync = async () => {
        const removedIds = current
          .filter(
            (oldProject) =>
              !next.some(
                (newProject) =>
                  newProject.id === oldProject.id
              )
          )
          .map((project) => project.id);

        if (removedIds.length) {
          const { error } = await supabase
            .from('projects')
            .delete()
            .in('id', removedIds);

          if (error) {
            console.error(
              'Failed to delete project:',
              error
            );
          }
        }

        if (next.length) {
          const { error } = await supabase
            .from('projects')
            .upsert(next.map(toDatabase));

          if (error) {
            console.error(
              'Failed to save projects:',
              error
            );
            return;
          }
        }

        window.dispatchEvent(
          new Event('portfolio-updated')
        );
      };

      void sync();

      return next;
    });
  };

  return {
    projects,
    setProjects,
    loading,
  };
}

function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  const target = useRef({
    x: -100,
    y: -100,
  });

  const position = useRef({
    x: -100,
    y: -100,
  });

  const frame = useRef<number | null>(null);
  const isVisible = useRef(false);

  useEffect(() => {
    const supportsMouse = window.matchMedia(
      '(pointer: fine) and (hover: hover)'
    ).matches;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (!supportsMouse || prefersReducedMotion) return;

    const cursor = cursorRef.current;

    if (!cursor) return;

    document.documentElement.classList.add(
      'custom-cursor-active'
    );

    const hideCursor = () => {
      isVisible.current = false;
      cursor.style.opacity = '0';
    };

    const showCursor = () => {
      isVisible.current = true;
      cursor.style.opacity = '1';
    };

    const resetCursor = () => {
      target.current = {
        x: -100,
        y: -100,
      };

      position.current = {
        x: -100,
        y: -100,
      };

      cursor.style.transform =
        'translate3d(-100px, -100px, 0) translate(-50%, -50%)';

      hideCursor();
    };

    const animate = () => {
      const dx =
        target.current.x - position.current.x;

      const dy =
        target.current.y - position.current.y;

      position.current.x += dx * 0.22;
      position.current.y += dy * 0.22;

      cursor.style.transform =
        `translate3d(${position.current.x}px, ${position.current.y}px, 0) translate(-50%, -50%)`;

      frame.current =
        requestAnimationFrame(animate);
    };

    const restartAnimation = () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }

      frame.current =
        requestAnimationFrame(animate);
    };

    const onMove = (event: PointerEvent) => {
      target.current = {
        x: event.clientX,
        y: event.clientY,
      };

      // When mouse comes back into the page,
      // immediately sync position once.
      if (!isVisible.current) {
        position.current = {
          x: event.clientX,
          y: event.clientY,
        };

        cursor.style.transform =
          `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
      }

      showCursor();

      const element =
        event.target instanceof Element
          ? event.target
          : null;

      cursor.classList.toggle(
        'is-hovering',
        Boolean(
          element?.closest(
            'a, button, [role="button"]'
          )
        )
      );

      cursor.classList.toggle(
        'is-project',
        Boolean(
          element?.closest(
            '.project-card, .project-art'
          )
        )
      );

      cursor.classList.toggle(
        'is-dark',
        Boolean(
          element?.closest('.contact-section')
        )
      );
    };

    const onLeave = () => {
      hideCursor();

      cursor.classList.remove(
        'is-hovering',
        'is-project',
        'is-dark'
      );
    };

    const onWindowBlur = () => {
      hideCursor();
    };

    const onWindowFocus = () => {
      resetCursor();
      restartAnimation();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        hideCursor();
      } else {
        resetCursor();
        restartAnimation();
      }
    };

    window.addEventListener(
      'pointermove',
      onMove,
      { passive: true }
    );

    document.documentElement.addEventListener(
      'pointerleave',
      onLeave
    );

    window.addEventListener(
      'blur',
      onWindowBlur
    );

    window.addEventListener(
      'focus',
      onWindowFocus
    );

    document.addEventListener(
      'visibilitychange',
      onVisibilityChange
    );

    restartAnimation();

    return () => {
      document.documentElement.classList.remove(
        'custom-cursor-active'
      );

      window.removeEventListener(
        'pointermove',
        onMove
      );

      document.documentElement.removeEventListener(
        'pointerleave',
        onLeave
      );

      window.removeEventListener(
        'blur',
        onWindowBlur
      );

      window.removeEventListener(
        'focus',
        onWindowFocus
      );

      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange
      );

      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={cursorRef}
      className="custom-cursor"
      aria-hidden="true"
      style={{ opacity: 0 }}
    >
      <span className="cursor-center" />
      <span className="cursor-dot cursor-dot-one" />
      <span className="cursor-dot cursor-dot-two" />
      <span className="cursor-dot cursor-dot-three" />
    </div>
  );
}

function ProjectArt({ kind, className = '' }: { kind: string; className?: string }) {
  if (
  kind.startsWith('data:') ||
  kind.startsWith('http://') ||
  kind.startsWith('https://')
) {
  return (
    <div
      className={`project-art ${className}`}
      data-testid="art-uploaded"
    >
      <img
        src={kind}
        alt="Uploaded project artwork"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          background: '#F5F4EF',
        }}
      />
    </div>
  );
}
  if (kind === 'red') return (
    <div className={`project-art ${className}`} data-testid={`art-${kind}`}>
      <div className="art-red-shape" />
      <div className="art-red-phone art-phone"><div className="phone-top">RED WHITE <span>⌁</span></div><div className="food-hero"><b>Good food,<br />good mood.</b><small>Curated for you</small></div><div className="food-row"><i /><span /><span /><span /></div><div className="food-list"><em /><em /></div></div>
      <div className="art-red-card"><span>ORDER<br />SOMETHING<br /><b>GOOD.</b></span><small>01 / 04</small></div>
      <div className="art-label">RW — 24</div>
    </div>
  );
  return (
    <div className={`project-art ${className}`} data-testid={`art-${kind}`}>
      <div className="art-fito-bg" />
      <div className="art-fito-phone art-phone"><div className="fito-top"><span>09:41</span><b>•••</b></div><small>Good morning, Vishal</small><strong>74 <i>kg</i></strong><div className="fito-ring"><span>72%</span></div><div className="fito-bars"><i /><i /><i /><i /><i /><i /><i /></div><div className="fito-nav"><b>◒</b><b>⌁</b><b>＋</b><b>◌</b></div></div>
      <div className="art-fito-word">FITO</div><div className="art-label">FIT — 24</div>
    </div>
  );
}

function PublicHeader() {
  return <header className="site-header"><div className="site-header-inner">
    <Link href="/admin/login" className="admin-link" data-testid="link-admin">Admin</Link>
    <Link
  href="/"
  className="brand-mark"
  data-testid="link-home"
  onClick={() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }}
>
  Vishal.
</Link>
    <nav className="header-nav" aria-label="Primary navigation">
      <a href="/#work" data-testid="link-work">Work</a><a href="/#about" data-testid="link-about">About</a><a href="#resume" data-testid="link-resume">Resume</a><a href="/#contact" data-testid="link-contact">Contact</a>
    </nav>
  </div></header>;
}

function TypingEyebrow() {
  const fullText = 'VISHAL · UI/UX DESIGNER · INDIA';
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let delay = isDeleting ? 35 : 70;

    if (!isDeleting && text === fullText) {
      delay = 1400;
    }

    if (isDeleting && text === '') {
      delay = 500;
    }

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (text === fullText) {
          setIsDeleting(true);
        } else {
          setText(fullText.slice(0, text.length + 1));
        }
      } else {
        if (text === '') {
          setIsDeleting(false);
        } else {
          setText(fullText.slice(0, text.length - 1));
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [text, isDeleting]);

  return (
    <div className="eyebrow typing-eyebrow">
      <span>{text}</span>
      <span className="typing-cursor">|</span>
    </div>
  );
}

function Home() {
  const { projects } = usePortfolio();
  const visible = projects.filter((project) => project.published).sort((a, b) => a.order - b.order);
  return <div className="editorial-page"><CustomCursor /><PublicHeader />
    <main>
      <section className="hero-wrap"><div>
        <div className="eyebrow"><TypingEyebrow /></div>
        <h1 className="hero-title">Useful <em>by design.</em></h1>
        <p className="hero-copy">I create simple and thoughtful digital experiences with a focus on usability and clear design.</p>
        <a className="text-link" href="#work" data-testid="link-selected-work">See selected work <span>↘</span></a>
      </div></section>
      <section id="work" className="section-rule"><div className="section-inner"><div className="section-kicker"><h2 className="section-title">Selected work</h2><span className="section-index">01 / 02</span></div>
        {visible.length ? <div className="work-grid">{visible.map((project) => <Link href={`/projects/${project.slug}`} className="project-card" key={project.id} data-testid={`card-project-${project.slug}`}><ProjectArt kind={project.cover} /><div className="project-meta"><div><div className="project-name">{project.title}</div><div className="project-category">{project.tags}</div></div><div className="project-arrow">↗</div></div></Link>)}</div> : <div className="empty-state">New work is taking shape here.</div>}
      </div></section>
      <section id="about" className="section-rule"><div className="section-inner"><div className="about-grid"><div><div className="eyebrow"><b>About</b></div><div className="about-side-note">A little about me</div></div><div><div className="about-copy"><p className="about-intro">I’m Vishal, a UI/UX designer who enjoys turning ideas and everyday problems into simple, user-friendly digital experiences.</p><p>My process usually starts with understanding the requirement, organizing the user flow, and creating wireframes before developing the final interface and prototype.</p><p>I enjoy learning new approaches, exploring design ideas, and improving my work through feedback and iteration.</p></div><div className="about-detail-grid"><div><div className="detail-label">Skills</div><div className="detail-list">{['UI Design','User Flows','Wireframing','Prototyping','UX Research','Usability Testing','Responsive Design','Design Thinking'].map((skill) => <span key={skill}>{skill}</span>)}</div></div><div><div className="detail-label">Tools</div><div className="detail-list"><span>Figma</span><span>Whimsical</span><span>FigJam</span></div></div></div></div></div></div></section>
      <section className="section-rule"><div className="section-inner"><div className="section-kicker"><h2 className="section-title">How I work</h2><span className="section-index">A simple process</span></div><div className="process-grid">{[['01','Understand','Understand the project requirement, purpose, and expected user journey.'],['02','Structure','Organize ideas, user flows, and screen structure.'],['03','Design','Create wireframes and develop the visual interface.'],['04','Prototype & Refine','Build interactions, review the experience, and improve the design through feedback.']].map(([num,title,text]) => <div className="process-item" key={num}><div className="process-num">{num}</div><h3>{title}</h3><p>{text}</p></div>)}</div></div></section>
      <section id="contact" className="contact-section"><div className="section-inner"><div className="contact-layout"><div><div className="eyebrow" style={{ color: 'hsl(var(--background) / .55)' }}>Available for good conversations</div><h2 className="contact-title">Let’s <em>connect.</em></h2></div><div className="contact-copy">I’m open to UI/UX opportunities, collaborations, and conversations about design.<div className="contact-links contact-links-primary">
  <a href="mailto:mallickvishal8@gmail.com">Email ↗</a>
  <a href="https://www.linkedin.com/in/vishal-mallick/" target="_blank" rel="noreferrer">LinkedIn ↗</a>
  <a href="https://www.behance.net/vishalmallick1" target="_blank" rel="noreferrer">Behance ↗</a>
  <a href="#resume">Resume ↗</a>
</div></div></div></div></section>
    </main><footer className="site-footer"><span>Vishal © 2026</span><div className="footer-links">
  <a href="https://www.linkedin.com/in/vishal-mallick/" target="_blank" rel="noreferrer">LinkedIn</a>
  <a href="https://www.behance.net/vishalmallick1" target="_blank" rel="noreferrer">Behance</a>
  <a href="mailto:mallickvishal8@gmail.com">Email</a>
  <a href="#resume">Resume</a>
</div></footer>
  </div>;
}

function RenderBlock({ block }: { block: Block }) {
  if (!block.visible) return null;
  if (block.type === 'section-break') return <div className="case-block section-rule" />;
  if (block.type === 'spacer') return <div className="case-block" style={{ height: 100 }} />;
  if (block.type === 'heading') return <div className="case-block narrow"><h2>{block.heading}</h2></div>;
  if (block.type === 'paragraph') return <div className="case-block narrow"><h2 style={{ fontSize: 'clamp(25px,3vw,40px)' }}>{block.heading}</h2><p>{block.text}</p></div>;
  const images = block.images?.length ? block.images : [block.image || 'fito'];
  const layout = block.type === 'two-column' ? 'two-col' : block.type === 'three-column' || block.type === 'gallery' || block.type === 'multi-image' ? 'three-col' : '';
  const imageBlocks = images.map((image, index) => <ProjectArt kind={image} className="case-art" key={`${image}-${index}`} />);
  if (block.type === 'image-text' || block.type === 'text-image') return <div className="case-block"><div className="case-intro"><div className={block.type === 'text-image' ? 'order-2' : ''}><ProjectArt kind={images[0]} className="case-art" /></div><div className="case-description"><h2>{block.heading || 'A considered detail.'}</h2><p>{block.text || 'A small decision can make an experience feel much clearer.'}</p></div></div></div>;
  return <div className={`case-block ${layout}`}><>{imageBlocks}</></div>;
}

function CaseStudy({ projects, projectOverride }: { projects: Project[]; projectOverride?: Project }) {
  const { slug } = useParams<{ slug: string }>();
  const project = projectOverride || projects.find((item) => item.slug === slug);
  if (!project || !project.published) return <NotFound />;
  return <div className="editorial-page"><CustomCursor /><PublicHeader /><main>
    <section className="case-hero"><Link href="/" className="back-link" data-testid="link-back-home"><ArrowLeft size={14} /> Back to selected work</Link><div className="eyebrow" style={{ marginTop: 70 }}>{project.tags}</div><h1 className="case-title">{project.title}</h1><div className="case-intro"><p className="case-description">{project.description}</p><div className="case-details"><div className="case-detail">Category<strong>{project.category}</strong></div><div className="case-detail">Year<strong>{project.year}</strong></div><div className="case-detail">Role<strong>UI/UX design</strong></div></div></div></section>
    <section className="case-canvas"><ProjectArt kind={project.cover} className="case-art" /></section><section className="case-content">{project.blocks.map((block) => <RenderBlock block={block} key={block.id} />)}</section>
  </main><footer className="site-footer"><span>Vishal © 2026</span><Link href="/">All work ↗</Link></footer></div>;
}

function AdminTopbar({ onLogout }: { onLogout?: () => void }) {
  return <header className="admin-topbar"><Link href="/admin" className="brand-mark">Vishal. <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 9, letterSpacing: '.1em', color: 'hsl(var(--muted-foreground))' }}>PORTFOLIO ADMIN</span></Link><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Link href="/" className="button-quiet">View site</Link>{onLogout && <button className="button-quiet" onClick={onLogout}><LogOut size={13} /> Sign out</button>}</div></header>;
}

function AdminLogin() {
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError('Invalid email or password.');
      return;
    }

    setLocation('/admin');
  };

  return (
    <div className="login-wrap">
      <form className="login-panel" onSubmit={submit}>
        <Link href="/" className="brand-mark">
          Vishal.
        </Link>

        <h1>
          Welcome
          <br />
          <em className="font-serif">back.</em>
        </h1>

        <p>
          Sign in to manage and publish your portfolio projects.
        </p>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            data-testid="input-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            data-testid="input-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
          />
        </div>

        {error && (
          <p style={{ color: '#c0392b', fontSize: 13 }}>
            {error}
          </p>
        )}

        <button
          className="button-dark"
          type="submit"
          data-testid="button-sign-in"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
          <ArrowDown
            size={14}
            style={{ transform: 'rotate(-45deg)' }}
          />
        </button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const { projects, setProjects } = usePortfolio();
  const [, setLocation] = useLocation();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setIsAuthenticated(!!session);
      setAuthChecked(true);

      if (!session) {
        setLocation('/admin/login');
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setIsAuthenticated(!!session);
      setAuthChecked(true);

      if (!session) {
        setLocation('/admin/login');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setLocation]);

  if (!authChecked || !isAuthenticated) return null;

  const togglePublish = (id: string) =>
    setProjects((items) =>
      items.map((p) =>
        p.id === id ? { ...p, published: !p.published } : p
      )
    );

  const deleteProject = (id: string) => {
    if (window.confirm('Delete this project from the demo workspace?')) {
      setProjects((items) => items.filter((p) => p.id !== id));
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setLocation('/admin/login');
  };

  return (
    <div className="admin-shell">
      <AdminTopbar onLogout={logout} />

      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <div className="eyebrow">Workspace / 01</div>
            <h1>Projects</h1>
            <p>Connected workspace · changes are saved to Supabase</p>
          </div>

          <Link
            href="/admin/projects/new"
            className="button-dark"
            data-testid="button-add-project"
          >
            <Plus size={15} />
            Add project
          </Link>
        </div>

        <div className="admin-table">
          <div
            className="admin-row"
            style={{
              minHeight: 40,
              color: 'hsl(var(--muted-foreground))',
              fontFamily: 'var(--app-font-mono)',
              fontSize: 10,
              textTransform: 'uppercase',
            }}
          >
            <span />
            <span>Project</span>
            <span>Status</span>
            <span>Featured</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {projects
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((project) => (
              <div className="admin-row" key={project.id}>
                <ProjectArt
                  kind={project.cover}
                  className="thumb-art"
                />

                <div>
                  <div className="admin-row-title">
                    {project.title}
                  </div>

                  <div className="admin-row-sub">
                    {project.category} · {project.year}
                  </div>
                </div>

                <span
                  className={`status ${
                    project.published ? 'published' : 'draft'
                  }`}
                >
                  {project.published ? 'Published' : 'Draft'}
                </span>

                <button
                  className="button-quiet"
                  style={{
                    justifySelf: 'start',
                    padding: '6px 9px',
                    fontSize: 10,
                  }}
                  onClick={() =>
                    setProjects((items) =>
                      items.map((p) =>
                        p.id === project.id
                          ? { ...p, featured: !p.featured }
                          : p
                      )
                    )
                  }
                >
                  {project.featured ? 'Featured' : 'Set featured'}
                </button>

                <div className="row-actions">
                  <Link
                    href={`/projects/${project.slug}`}
                    className="icon-button"
                    title="Preview"
                    data-testid={`link-preview-${project.slug}`}
                  >
                    <Eye size={14} />
                  </Link>

                  <Link
                    href={`/admin/projects/${project.slug}`}
                    className="icon-button"
                    title="Edit"
                    data-testid={`link-edit-${project.slug}`}
                  >
                    <span style={{ fontSize: 12 }}>Edit</span>
                  </Link>

                  <button
                    className="icon-button"
                    title={
                      project.published ? 'Unpublish' : 'Publish'
                    }
                    onClick={() => togglePublish(project.id)}
                  >
                    {project.published ? (
                      <EyeOff size={14} />
                    ) : (
                      <Check size={14} />
                    )}
                  </button>

                  <button
                    className="icon-button"
                    title="Delete"
                    onClick={() => deleteProject(project.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
        </div>

        {!projects.length && (
          <div className="empty-state" style={{ marginTop: 24 }}>
            No projects yet. Start a new story with the composer.
          </div>
        )}
      </main>
    </div>
  );
}

const blockLabels: Record<BlockType, string> = { heading: 'Heading', paragraph: 'Paragraph', image: 'Single image', 'multi-image': 'Multiple images', 'two-column': 'Two column', 'three-column': 'Three column', gallery: 'Image gallery', 'image-text': 'Image + text', 'text-image': 'Text + image', 'section-break': 'Section break', spacer: 'Spacer' };

function BlockEditor({ block, index, total, onChange, onMove, onDuplicate, onDelete }: { block: Block; index: number; total: number; onChange: (block: Block) => void; onMove: (dir: number) => void; onDuplicate: () => void; onDelete: () => void }) {
  const [hidden, setHidden] = useState(!block.visible);
  const update = (changes: Partial<Block>) => onChange({ ...block, ...changes });
  const handleFile = async (
  event: ChangeEvent<HTMLInputElement>,
  imageIndex = 0
) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    alert('Image must be smaller than 10 MB.');
    event.target.value = '';
    return;
  }

  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ];

  if (!allowedTypes.includes(file.type)) {
    alert('Please upload PNG, JPG, WEBP or GIF only.');
    event.target.value = '';
    return;
  }

  const extension =
    file.name.split('.').pop()?.toLowerCase() || 'jpg';

  const safeName = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-');

  const filePath =
    `projects/${Date.now()}-${safeName}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('portfolio-assets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Image upload failed:', uploadError);
    alert(`Image upload failed: ${uploadError.message}`);
    event.target.value = '';
    return;
  }

  const { data } = supabase.storage
    .from('portfolio-assets')
    .getPublicUrl(filePath);

  const imageUrl = data.publicUrl;

  const images =
    block.images && block.images.length
      ? [...block.images]
      : block.image
        ? [block.image]
        : [];

  if (imageIndex >= images.length) {
    images.push(imageUrl);
  } else {
    images[imageIndex] = imageUrl;
  }

  onChange({
    ...block,
    image: images[0] || imageUrl,
    images,
  });

  event.target.value = '';
};
  const hasImage = ['image','multi-image','two-column','three-column','gallery','image-text','text-image'].includes(block.type);
  return <div className={`editor-block ${hidden ? 'opacity-60' : ''}`} data-testid={`editor-block-${block.id}`}><div className="editor-block-head"><span className="block-type">{String(index + 1).padStart(2, '0')} / {blockLabels[block.type]}</span><div className="block-controls"><button className="icon-button" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"><ArrowUp size={13} /></button><button className="icon-button" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down"><ArrowDown size={13} /></button><button className="icon-button" onClick={onDuplicate} title="Duplicate"><Copy size={13} /></button><button className="icon-button" onClick={() => { setHidden(!hidden); update({ visible: hidden }); }} title={hidden ? 'Show' : 'Hide'}>{hidden ? <Eye size={13} /> : <EyeOff size={13} />}</button><button className="icon-button" onClick={onDelete} title="Delete"><Trash2 size={13} /></button></div></div>
    {(block.type === 'heading' || block.type === 'paragraph' || block.type === 'image-text' || block.type === 'text-image') && <div className="field"><label>Heading</label><input value={block.heading || ''} placeholder="A clear, useful heading" onChange={(event) => update({ heading: event.target.value })} /></div>}
    {(block.type === 'paragraph' || block.type === 'image-text' || block.type === 'text-image') && <div className="field"><label>Text</label><textarea value={block.text || ''} placeholder="Write a little context for this section." onChange={(event) => update({ text: event.target.value })} /></div>}
    {hasImage && <div><div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:12 }}>{(block.images || [block.image || 'fito']).map((image, imageIndex) => <div key={imageIndex} style={{ position:'relative', width: block.type === 'three-column' ? 'calc(33.3% - 8px)' : 110, minWidth:90 }}><ProjectArt kind={image} className="case-art" /><button className="icon-button" style={{ position:'absolute', top:5, right:5, background:'hsl(var(--background))' }} onClick={() => { const images = (block.images || [block.image || 'fito']).filter((_, i) => i !== imageIndex); onChange({ ...block, images: images.length ? images : ['fito'], image: images[0] }); }} title="Delete image"><X size={12} /></button></div>)}</div><div style={{ display:'flex', gap:7, alignItems:'center', flexWrap:'wrap' }}><label className="button-quiet" style={{ cursor:'pointer' }}><ImagePlus size={13} /> Replace image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => handleFile(event)} /></label><label className="button-quiet" style={{ cursor:'pointer' }}>Add image
<input
  type="file"
  accept="image/png,image/jpeg,image/webp,image/gif"
  hidden
  onChange={(event) =>
    handleFile(
      event,
      block.images?.length ?? (block.image ? 1 : 0)
    )
  }
/></label><select aria-label="Image layout" value={block.layout || 'standard'} onChange={(event) => update({ layout: event.target.value })} style={{ padding:'8px', border:'1px solid hsl(var(--border))', background:'hsl(var(--background))', fontSize:11 }}><option value="standard">Standard</option><option value="wide">Wide</option><option value="full">Full width</option><option value="stacked">Stacked</option></select></div></div>}
  </div>;
}

function PreviewOverlay({ project, close }: { project: Project; close: () => void }) {
  return <div style={{ position:'fixed', inset:0, zIndex:50, overflow:'auto', background:'hsl(var(--background))' }}><button className="button-quiet" onClick={close} style={{ position:'fixed', top:18, right:20, zIndex:55, background:'hsl(var(--background))' }}><X size={14} /> Close preview</button><CaseStudy projects={[{ ...project, published:true }]} projectOverride={{ ...project, published:true }} /></div>;
}

function Composer() {
  const { slug } = useParams<{ slug: string }>();
  const { projects, setProjects, loading } = usePortfolio();
  const [, setLocation] = useLocation();

  const isNewProject = !slug || slug === 'new';

  const createBlankProject = (): Project => ({
    id: uid(),
    title: 'Untitled project',
    slug: 'untitled-project',
    description: '',
    category: 'UI/UX project',
    year: '2026',
    tags: 'UI/UX · Case study',
    featured: false,
    published: false,
    order: projects.length + 1,
    cover: 'fito',
    blocks: [],
  });

  const [project, setProject] = useState<Project>(() =>
    createBlankProject()
  );

  const [projectReady, setProjectReady] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadedRoute = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const routeKey = isNewProject ? '__new__' : String(slug);

    if (loadedRoute.current === routeKey) return;

    if (isNewProject) {
      setProject(createBlankProject());
      loadedRoute.current = routeKey;
      setProjectReady(true);
      return;
    }

    const existing = projects.find(
      (item) => item.slug === slug
    );

    if (existing) {
      setProject({
        ...existing,
        blocks: existing.blocks.map((block) => ({
          ...block,
          images: block.images
            ? [...block.images]
            : block.images,
        })),
      });

      loadedRoute.current = routeKey;
      setProjectReady(true);
      return;
    }

    setLocation('/admin');
  }, [loading, slug, isNewProject, projects, setLocation]);

  const update = (changes: Partial<Project>) =>
    setProject((value) => ({
      ...value,
      ...changes,
    }));

  const handleCoverFile = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be smaller than 10 MB.');
      event.target.value = '';
      return;
    }

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Please upload PNG, JPG, WEBP or GIF only.');
      event.target.value = '';
      return;
    }

    const extension =
      file.name.split('.').pop()?.toLowerCase() || 'jpg';

    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-');

    const filePath =
      `covers/${project.slug}-${Date.now()}-${safeName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('portfolio-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Cover upload failed:', uploadError);
      alert(`Cover upload failed: ${uploadError.message}`);
      event.target.value = '';
      return;
    }

    const { data } = supabase.storage
      .from('portfolio-assets')
      .getPublicUrl(filePath);

    update({
      cover: data.publicUrl,
    });

    event.target.value = '';
  };

  const save = (publish?: boolean) => {
    const next = {
      ...project,
      published:
        publish === undefined
          ? project.published
          : publish,
    };

    setProjects((items) =>
      items.some((item) => item.id === next.id)
        ? items.map((item) =>
            item.id === next.id ? next : item
          )
        : [...items, next]
    );

    setProject(next);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 1800);

    if (isNewProject) {
      loadedRoute.current = next.slug;
      setLocation(`/admin/projects/${next.slug}`);
    }
  };

  const addBlock = (type: BlockType) => {
    const imageTypes = [
      'image',
      'multi-image',
      'two-column',
      'three-column',
      'gallery',
      'image-text',
      'text-image',
    ];

    const block: Block = {
      id: uid(),
      type,
      visible: true,
      image: imageTypes.includes(type)
        ? project.cover
        : undefined,
      images: imageTypes.includes(type)
        ? [project.cover]
        : undefined,
      heading:
        type === 'heading'
          ? 'New section'
          : undefined,
      text:
        type === 'paragraph'
          ? 'Add some context to this section.'
          : undefined,
    };

    update({
      blocks: [...project.blocks, block],
    });

    setAddOpen(false);
  };

  const move = (index: number, dir: number) => {
    const blocks = [...project.blocks];
    const to = index + dir;

    if (to < 0 || to >= blocks.length) return;

    [blocks[index], blocks[to]] = [
      blocks[to],
      blocks[index],
    ];

    update({ blocks });
  };

  if (loading || !projectReady) {
    return (
      <div className="admin-shell">
        <main className="admin-main">
          <div className="eyebrow">
            Loading project...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <AdminTopbar />

      <main className="admin-main">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 15,
            alignItems: 'center',
            marginBottom: 35,
          }}
        >
          <Link href="/admin" className="back-link">
            <ArrowLeft size={14} />
            All projects
          </Link>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'end',
            }}
          >
            <button
              className="button-quiet"
              onClick={() => setPreview(true)}
            >
              <Eye size={14} />
              Preview
            </button>

            <button
              className="button-quiet"
              onClick={() => save()}
            >
              <Save size={14} />
              {saved ? 'Saved' : 'Save draft'}
            </button>

            <button
              className="button-dark"
              onClick={() => save(true)}
            >
              <Check size={14} />
              Publish
            </button>
          </div>
        </div>

        <div className="editor-layout">
          <aside className="editor-sidebar">
            <div className="eyebrow">
              Project composer
            </div>

            <h2>
              {project.title || 'Untitled project'}
            </h2>

            <div className="field">
              <label htmlFor="title">
                Project title
              </label>

              <input
                id="title"
                value={project.title}
                onChange={(event) =>
                  update({
                    title: event.target.value,
                  })
                }
                data-testid="input-project-title"
              />
            </div>

            <div className="field">
              <label htmlFor="slug">Slug</label>

              <input
                id="slug"
                value={project.slug}
                onChange={(event) =>
                  update({
                    slug: event.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '-'),
                  })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="description">
                Short description
              </label>

              <textarea
                id="description"
                value={project.description}
                onChange={(event) =>
                  update({
                    description:
                      event.target.value,
                  })
                }
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div className="field">
                <label>Category</label>

                <input
                  value={project.category}
                  onChange={(event) =>
                    update({
                      category:
                        event.target.value,
                    })
                  }
                />
              </div>

              <div className="field">
                <label>Year</label>

                <input
                  value={project.year}
                  onChange={(event) =>
                    update({
                      year: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="field">
              <label>Tags</label>

              <input
                value={project.tags}
                onChange={(event) =>
                  update({
                    tags: event.target.value,
                  })
                }
              />
            </div>

            <div className="field">
              <label>Display / cover image</label>

              <div
                style={{
                  marginTop: 8,
                  marginBottom: 10,
                  maxWidth: 220,
                }}
              >
                <ProjectArt
                  kind={project.cover}
                  className="case-art"
                />
              </div>

              <label
                className="button-quiet"
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                }}
              >
                <ImagePlus size={13} />
                Replace cover image

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={handleCoverFile}
                />
              </label>
            </div>

            <div className="field">
              <label>Display order</label>

              <input
                type="number"
                value={project.order}
                onChange={(event) =>
                  update({
                    order: Number(
                      event.target.value
                    ),
                  })
                }
              />
            </div>

            <div className="toggle-line">
              <span>Featured project</span>

              <button
                className={`toggle ${
                  project.featured ? 'on' : ''
                }`}
                onClick={() =>
                  update({
                    featured:
                      !project.featured,
                  })
                }
                aria-label="Toggle featured"
              >
                <span />
              </button>
            </div>

            <div className="toggle-line">
              <span>Published</span>

              <button
                className={`toggle ${
                  project.published ? 'on' : ''
                }`}
                onClick={() =>
                  update({
                    published:
                      !project.published,
                  })
                }
                aria-label="Toggle published"
              >
                <span />
              </button>
            </div>

            <div
              style={{
                marginTop: 20,
                fontSize: 11,
                color:
                  'hsl(var(--muted-foreground))',
                lineHeight: 1.55,
              }}
            >
              Project content and images are
              connected to Supabase.
            </div>
          </aside>

          <section>
            <div
              className="section-kicker"
              style={{ marginBottom: 18 }}
            >
              <div>
                <div className="eyebrow">
                  Case study content
                </div>

                <h2
                  className="section-title"
                  style={{ marginTop: 13 }}
                >
                  Build the story.
                </h2>
              </div>

              <span className="section-index">
                {project.blocks.length} blocks
              </span>
            </div>

            <div className="block-stack">
              {project.blocks.map(
                (block, index) => (
                  <BlockEditor
                    block={block}
                    index={index}
                    total={
                      project.blocks.length
                    }
                    key={block.id}
                    onChange={(next) =>
                      update({
                        blocks:
                          project.blocks.map(
                            (item) =>
                              item.id ===
                              block.id
                                ? next
                                : item
                          ),
                      })
                    }
                    onMove={(dir) =>
                      move(index, dir)
                    }
                    onDuplicate={() =>
                      update({
                        blocks: [
                          ...project.blocks.slice(
                            0,
                            index + 1
                          ),
                          {
                            ...block,
                            id: uid(),
                          },
                          ...project.blocks.slice(
                            index + 1
                          ),
                        ],
                      })
                    }
                    onDelete={() =>
                      update({
                        blocks:
                          project.blocks.filter(
                            (item) =>
                              item.id !==
                              block.id
                          ),
                      })
                    }
                  />
                )
              )}
            </div>

            <div className="add-block-panel">
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                }}
              >
                <h3>Add a flexible block</h3>

                <button
                  className="button-quiet"
                  onClick={() =>
                    setAddOpen(!addOpen)
                  }
                >
                  {addOpen ? (
                    <X size={13} />
                  ) : (
                    <Plus size={13} />
                  )}

                  {addOpen
                    ? 'Close'
                    : 'Add block'}
                </button>
              </div>

              {addOpen && (
                <div className="block-options">
                  {(
                    Object.keys(
                      blockLabels
                    ) as BlockType[]
                  ).map((type) => (
                    <button
                      className="block-option"
                      key={type}
                      onClick={() =>
                        addBlock(type)
                      }
                    >
                      {blockLabels[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {preview && (
        <PreviewOverlay
          project={project}
          close={() => setPreview(false)}
        />
      )}
    </div>
  );
}

function NotFound() { return <div className="login-wrap"><div className="login-panel"><div className="eyebrow">404 / Not found</div><h1>That page<br /><em className="font-serif">wandered off.</em></h1><p>The work you’re looking for isn’t published here.</p><Link className="button-dark" href="/">Back to the portfolio</Link></div></div>; }

function Router() {
  const [location] = useLocation();
  const portfolio = usePortfolio();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/projects/:slug"><CaseStudy projects={portfolio.projects} /></Route><Route path="/admin/login" component={AdminLogin} /><Route path="/admin/projects/new" component={Composer} /><Route path="/admin/projects/:slug" component={Composer} /><Route path="/admin" component={AdminDashboard} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }

export default App;