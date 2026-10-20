import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useParams,
} from "react-router-dom";
import api from "./api";
import "./App.css";

function formatDate(date) {
  if (!date) return "Date unavailable";

  return new Date(`${String(date).slice(0, 10)}T00:00:00`)
    .toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="navbar">
      <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
        <span className="brand-icon">L</span>
        <span>Lost<span className="brand-accent">Link</span></span>
      </Link>

      <button
        className="menu-toggle"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      <nav className={menuOpen ? "nav-links nav-open" : "nav-links"}>
        <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
        <NavLink to="/items" onClick={() => setMenuOpen(false)}>Browse Items</NavLink>
        <NavLink to="/report" onClick={() => setMenuOpen(false)}>Report Item</NavLink>
        <Link to="/admin" className="nav-admin" onClick={() => setMenuOpen(false)}>
          Admin
        </Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <Link to="/" className="footer-brand">LostLink</Link>
      <p>Every lost item deserves a way home.</p>
      <span>Built for a more connected campus.</span>
    </footer>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value ?? "—"}</strong>
      </div>
    </div>
  );
}

function ItemCard({ item }) {
  const isLost = item.type === "lost";

  return (
    <article className="item-card">
      <Link to={`/items/${item.id}`} className="item-image">
        {item.image_path ? (
          <img
            src={`http://localhost:5000/${String(item.image_path).replace(/^\/+/, "")}`}
            alt={item.title}
          />
        ) : (
          <div className="image-placeholder">
            <span>{isLost ? "🔎" : "🎒"}</span>
            <small>{isLost ? "Lost item" : "Found item"}</small>
          </div>
        )}
        <span className={`type-badge ${isLost ? "lost-badge" : "found-badge"}`}>
          {isLost ? "Lost" : "Found"}
        </span>
      </Link>

      <div className="item-card-body">
        <div className="item-card-top">
          <span className="category-label">{item.category_name || "Other"}</span>
          <span className={`status-dot status-${item.status}`}>
            {item.status}
          </span>
        </div>

        <Link to={`/items/${item.id}`} className="item-title">
          {item.title}
        </Link>

        <p className="item-description">
          {item.description || "No description provided."}
        </p>

        <div className="item-meta">
          <span>📍 {item.location}</span>
          <span>📅 {formatDate(item.date_occurred)}</span>
        </div>

        <Link to={`/items/${item.id}`} className="item-card-link">
          View details <span>→</span>
        </Link>
      </div>
    </article>
  );
}

function ItemGrid({ items, loading, error }) {
  if (loading) {
    return <div className="state-message"><div className="spinner" /> Loading items...</div>;
  }

  if (error) {
    return <div className="state-message error-message">{error}</div>;
  }

  if (!items.length) {
    return (
      <div className="state-message empty-state">
        <span>🔍</span>
        <h3>No items found</h3>
        <p>Try changing your search or filters.</p>
      </div>
    );
  }

  return <div className="item-grid">{items.map((item) => <ItemCard key={item.id} item={item} />)}</div>;
}

function Home() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    Promise.all([api.getItems({ limit: 6 }), api.getStats()])
      .then(([itemsResult, statsResult]) => {
        if (!active) return;
        setItems(itemsResult.data || []);
        setStats(statsResult.data || {});
      })
      .catch(() => {
        if (active) setError("Couldn't load the latest items. Check that the backend is running.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const totals = stats?.items || {};

  function handleSearch(event) {
    event.preventDefault();
    navigate(`/items?search=${encodeURIComponent(search)}`);
  }

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow"><span /> LOST SOMETHING? FOUND SOMETHING?</div>
          <h1>Lost today.<br /><span>Found tomorrow.</span></h1>
          <p className="hero-description">
            A little help goes a long way. Find your missing belongings
            or help someone reunite with theirs, all in one place.
          </p>

          <form className="hero-search" onSubmit={handleSearch}>
            <span className="search-icon">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search for a wallet, keys, phone..."
              aria-label="Search items"
            />
            <button type="submit">Search <span>→</span></button>
          </form>

          <div className="hero-actions">
            <Link to="/report?type=lost" className="button-primary">I lost something ↗</Link>
            <Link to="/report?type=found" className="button-secondary">I found something</Link>
          </div>

          <div className="hero-trust">
            <span className="trust-check">✓</span>
            Campus community powered
            <span className="trust-separator">·</span>
            Simple. Safe. Together.
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-orbit orbit-one" />
          <div className="visual-orbit orbit-two" />
          <div className="visual-center">
            <div className="visual-card card-back">🎧</div>
            <div className="visual-card card-middle">🔑</div>
            <div className="visual-card card-front">
              <div className="visual-card-icon">✦</div>
              <span>Things find their way.</span>
              <strong>Back to you.</strong>
            </div>
          </div>
          <div className="floating-note note-one">🎒 <span>Found nearby</span></div>
          <div className="floating-note note-two">💙 <span>Community first</span></div>
          <div className="visual-caption">ONE COMMUNITY. FEWER LOST THINGS.</div>
        </div>
      </section>

      <section className="stats-section">
        <div className="section-heading">
          <div><span className="eyebrow">THE COMMUNITY IN ACTION</span><h2>Small things. <span>Big reunions.</span></h2></div>
          <p>Every report brings someone one step closer to finding what matters.</p>
        </div>

        <div className="stats-grid">
          <StatCard icon="📦" label="Items reported" value={totals.total} />
          <StatCard icon="🔎" label="Lost items" value={totals.lost} />
          <StatCard icon="🤝" label="Found items" value={totals.found} />
          <StatCard icon="💚" label="Items returned" value={stats?.recovery?.returned} />
        </div>
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <div><span className="eyebrow">FRESH FROM THE COMMUNITY</span><h2>Recently <span>reported</span></h2></div>
          <Link to="/items" className="text-link">Explore all items →</Link>
        </div>

        <ItemGrid items={items} loading={loading} error={error} />

        <div className="center-action">
          <Link to="/items" className="button-secondary">Browse all items ↗</Link>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-icon">✳</div>
        <div><span className="eyebrow">BE SOMEONE'S GOOD NEWS</span><h2>Found something? <span>Make someone's day.</span></h2><p>One quick report could reunite someone with something they thought was gone.</p></div>
        <Link to="/report?type=found" className="button-light">Report a found item →</Link>
      </section>
    </>
  );
}

function BrowseItems() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: "", type: "", category_id: "", status: "", page: 1, limit: 9 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function loadItems(currentFilters = filters) {
    setLoading(true);
    setError("");

    try {
      const params = { ...currentFilters };
      if (!params.category_id) delete params.category_id;
      const result = await api.getItems(params);
      setItems(result.data || []);
      setPagination(result.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.message || "Unable to load items.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.getCategories()
      .then((result) => setCategories(result.data || []))
      .catch(() => setCategories([]));

    const params = new URLSearchParams(window.location.search);
    const initial = {
      search: params.get("search") || "",
      type: params.get("type") || "",
      category_id: "",
      status: "",
      page: 1,
      limit: 9,
    };

    setFilters(initial);
    loadItems(initial);
  }, []);

  function updateFilter(key, value) {
    const updated = { ...filters, [key]: value, page: 1 };
    setFilters(updated);
    loadItems(updated);
  }

  function changePage(page) {
    const updated = { ...filters, page };
    setFilters(updated);
    loadItems(updated);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <span className="eyebrow">THE LOST & FOUND DIRECTORY</span>
        <h1>Find what you're <span>looking for.</span></h1>
        <p>Browse reports from your campus community.</p>
      </div>

      <div className="filter-panel">
        <label className="filter-search">
          <span>⌕</span>
          <input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Search items..." />
        </label>

        <select value={filters.type} onChange={(e) => updateFilter("type", e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          <option value="lost">Lost</option>
          <option value="found">Found</option>
        </select>

        <select value={filters.category_id} onChange={(e) => updateFilter("category_id", e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>

        <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="claimed">Claimed</option>
          <option value="returned">Returned</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="results-summary"><span>{pagination.total ?? items.length} items</span><span>Help an item find its way home.</span></div>

      <ItemGrid items={items} loading={loading} error={error} />

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button disabled={pagination.page <= 1} onClick={() => changePage(pagination.page - 1)}>← Previous</button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => changePage(pagination.page + 1)}>Next →</button>
        </div>
      )}

      <div className="center-action"><button className="button-primary" onClick={() => navigate("/report")}>+ Report an item</button></div>
    </section>
  );
}

function ItemDetails() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claim, setClaim] = useState({ claimant_name: "", claimant_email: "", proof_description: "" });
  const [claimMessage, setClaimMessage] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    api.getItem(id)
      .then((result) => setItem(result.data))
      .catch((err) => setError(err.message || "Couldn't load item details."))
      .finally(() => setLoading(false));
  }, [id]);

  async function submitClaim(event) {
    event.preventDefault();
    setClaiming(true);
    setClaimError("");
    setClaimMessage("");

    try {
      const result = await api.createClaim(id, claim);
      setClaimMessage(result.message || "Claim submitted successfully.");
      setClaim({ claimant_name: "", claimant_email: "", proof_description: "" });
    } catch (err) {
      setClaimError(err.message || "Unable to submit claim.");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) return <div className="state-message"><div className="spinner" /> Loading item...</div>;
  if (error) return <div className="state-message error-message">{error}</div>;
  if (!item) return <div className="state-message">Item not found.</div>;

  const canClaim = item.type === "found" && item.status === "open";

  return (
    <section className="page-section details-page">
      <Link to="/items" className="back-link">← Back to all items</Link>

      <div className="details-layout">
        <div className="details-image">
          {item.image_path ? <img src={`http://localhost:5000/${String(item.image_path).replace(/^\/+/, "")}`} alt={item.title} /> : <div className="image-placeholder details-placeholder"><span>{item.type === "lost" ? "🔎" : "🎒"}</span><small>No image available</small></div>}
        </div>

        <div className="details-content">
          <span className={`type-badge inline-badge ${item.type === "lost" ? "lost-badge" : "found-badge"}`}>{item.type}</span>
          <span className={`status-dot status-${item.status}`}>{item.status}</span>
          <h1>{item.title}</h1>
          <p className="details-description">{item.description || "No description provided."}</p>

          <div className="details-info">
            <div><span>Category</span><strong>{item.category_name}</strong></div>
            <div><span>Location</span><strong>📍 {item.location}</strong></div>
            <div><span>Date reported</span><strong>{formatDate(item.date_occurred)}</strong></div>
          </div>

          {canClaim && (
            <div className="claim-panel">
              <h2>Is this yours?</h2>
              <p>Describe a detail that helps verify ownership.</p>
              {claimMessage && <div className="success-message">{claimMessage}</div>}
              {claimError && <div className="error-message">{claimError}</div>}

              <form onSubmit={submitClaim} className="stacked-form">
                <label>Your name<input required maxLength="100" value={claim.claimant_name} onChange={(e) => setClaim({ ...claim, claimant_name: e.target.value })} /></label>
                <label>Email address<input required type="email" value={claim.claimant_email} onChange={(e) => setClaim({ ...claim, claimant_email: e.target.value })} /></label>
                <label>Proof of ownership<textarea required minLength="5" maxLength="1000" value={claim.proof_description} onChange={(e) => setClaim({ ...claim, proof_description: e.target.value })} placeholder="Describe a unique feature or detail..." /></label>
                <button disabled={claiming} className="button-primary">{claiming ? "Submitting..." : "Submit claim →"}</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {item.status_history?.length > 0 && (
        <div className="history-panel">
          <h2>Status history</h2>
          {item.status_history.map((entry, index) => (
            <div className="history-entry" key={entry.id || index}>
              <span className="history-marker" />
              <div><strong>{entry.status}</strong><p>{new Date(entry.changed_at).toLocaleString()}</p></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReportItem() {
  const params = new URLSearchParams(window.location.search);
  const initialType = params.get("type") === "found" ? "found" : "lost";
  const [type, setType] = useState(initialType);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    location: "",
    date_occurred: new Date().toISOString().slice(0, 10),
    reporter_name: "",
    reporter_email: "",
    reporter_phone: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    api.getCategories()
      .then((result) => setCategories(result.data || []))
      .catch(() => setError("Unable to load categories. Please check the backend."))
      .finally(() => setLoadingCategories(false));
  }, []);

  async function submitReport(event) {
  event.preventDefault();

  // Save the form reference before the asynchronous request
  const formElement = event.currentTarget;

  setSubmitting(true);
  setError("");
  setMessage("");

  const formData = new FormData();
  formData.append("type", type);

  Object.entries(form).forEach(([key, value]) => {
    if (value !== "") {
      formData.append(key, value);
    }
  });

  const image = formElement.elements.image?.files?.[0];

  if (image) {
    formData.append("image", image);
  }

  try {
    const result = await api.createItem(formData);

    setMessage(result.message || "Your report has been submitted.");

    // Reset safely using the saved form reference
    formElement.reset();

    setForm({
      title: "",
      description: "",
      category_id: "",
      location: "",
      date_occurred: new Date().toISOString().slice(0, 10),
      reporter_name: "",
      reporter_email: "",
      reporter_phone: "",
    });

    setTimeout(() => navigate("/items"), 1200);
  } catch (err) {
    const validation = err.data?.errors
      ?.map((entry) => entry.message)
      .join(" ");

    setError(
      validation || err.message || "Unable to submit the report."
    );
  } finally {
    setSubmitting(false);
  }
}

  return (
    <section className="page-section form-page">
      <div className="page-heading">
        <span className="eyebrow">EVERY REPORT MAKES A DIFFERENCE</span>
        <h1>Let's bring it <span>back home.</span></h1>
        <p>Share the details and let the community help.</p>
      </div>

      <div className="form-card">
        <div className="type-switch">
          <button type="button" className={type === "lost" ? "type-option active-lost" : "type-option"} onClick={() => setType("lost")}>🔎 I lost something</button>
          <button type="button" className={type === "found" ? "type-option active-found" : "type-option"} onClick={() => setType("found")}>🎒 I found something</button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={submitReport} className="report-form">
          <div className="form-grid">
            <label>Item title *<input required maxLength="120" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Blue water bottle" /></label>
            <label>Category *
              <select required value={form.category_id} disabled={loadingCategories} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select a category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>Location *
              <input required maxLength="200" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Where was it lost or found?" />
            </label>
            <label>Date *
              <input required type="date" value={form.date_occurred} onChange={(e) => setForm({ ...form, date_occurred: e.target.value })} />
            </label>
            <label className="full-width">Description
              <textarea maxLength="2000" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add identifying details..." />
            </label>
            <label>Image (optional)<input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label>
            <label>Your name *<input required maxLength="100" value={form.reporter_name} onChange={(e) => setForm({ ...form, reporter_name: e.target.value })} /></label>
            <label>Email address *<input required type="email" value={form.reporter_email} onChange={(e) => setForm({ ...form, reporter_email: e.target.value })} /></label>
            <label>Phone (optional)<input type="tel" maxLength="20" value={form.reporter_phone} onChange={(e) => setForm({ ...form, reporter_phone: e.target.value })} /></label>
          </div>

          <div className="form-privacy">🔒 Your contact details are stored privately and aren't shown in public item listings.</div>
          <button type="submit" disabled={submitting} className="button-primary form-submit">{submitting ? "Submitting report..." : "Submit report →"}</button>
        </form>
      </div>
    </section>
  );
}

function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [itemId, setItemId] = useState("");
  const [claims, setClaims] = useState([]);
  const [claimStatus, setClaimStatus] = useState("");
  const [itemStatus, setItemStatus] = useState("claimed");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function adminRequest(endpoint, options = {}) {
    return fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}${endpoint}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        "x-admin-passcode": passcode,
        ...options.headers,
      },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Admin request failed.");
      return data;
    });
  }

  async function loadClaims(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const result = await adminRequest(`/items/${itemId}/claims`);
      setClaims(result.data || []);
      setMessage("Claims loaded successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateClaim(id, status) {
    setMessage("");
    setError("");

    try {
      const result = await adminRequest(`/claims/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ claim_status: status }),
      });
      setMessage(result.message || `Claim ${status}.`);
      await loadClaims({ preventDefault() {} });
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateItemStatus(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const result = await adminRequest(`/items/${itemId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: itemStatus, note }),
      });
      setMessage(result.message || "Item status updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page-section admin-page">
      <div className="page-heading">
        <span className="eyebrow">RESTRICTED ACCESS</span>
        <h1>Admin <span>workspace.</span></h1>
        <p>Manage claims and update item statuses.</p>
      </div>

      <div className="admin-warning">🔐 This is a prototype admin interface. Your passcode is kept in this page's memory and isn't stored in your source code.</div>

      <div className="form-card admin-card">
        <label>Admin passcode
          <input type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Enter your admin passcode" />
        </label>

        <form onSubmit={loadClaims} className="admin-form">
          <label>Item ID<input type="number" min="1" required value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder="Enter item ID" /></label>
          <button className="button-primary" disabled={loading || !passcode}>Load claims</button>
        </form>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {claims.length > 0 && (
          <div className="claims-list">
            <h2>Claims for item #{itemId}</h2>
            {claims.map((claimItem) => (
              <article className="claim-card" key={claimItem.id}>
                <div><strong>{claimItem.claimant_name}</strong><p>{claimItem.proof_description}</p><span className="status-dot">{claimItem.claim_status}</span></div>
                {claimItem.claim_status === "pending" && (
                  <div className="claim-actions">
                    <button onClick={() => updateClaim(claimItem.id, "approved")} className="button-primary">Approve</button>
                    <button onClick={() => updateClaim(claimItem.id, "rejected")} className="button-danger">Reject</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <hr className="form-divider" />

        <form onSubmit={updateItemStatus} className="stacked-form">
          <h2>Update item status</h2>
          <label>New status
            <select value={itemStatus} onChange={(e) => setItemStatus(e.target.value)}>
              <option value="claimed">Claimed</option>
              <option value="returned">Returned</option>
              <option value="closed">Closed</option>
              <option value="open">Open</option>
            </select>
          </label>
          <label>Admin note<textarea maxLength="500" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the status history..." /></label>
          <button className="button-primary" disabled={!passcode || !itemId}>Update status →</button>
        </form>
      </div>
    </section>
  );
}

function NotFound() {
  return (
    <section className="state-message not-found">
      <span>🧭</span>
      <h1>Looks like this page got lost.</h1>
      <Link to="/" className="button-primary">Back to home</Link>
    </section>
  );
}

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/items" element={<BrowseItems />} />
          <Route path="/items/:id" element={<ItemDetails />} />
          <Route path="/report" element={<ReportItem />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}