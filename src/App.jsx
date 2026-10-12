import React, { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:8080/api/repairs";
const AUTH = "http://localhost:8080/api/auth";

const EMPTY = {
  customer: "",
  device: "",
  issue: "",
  status: "PENDING",
  cost: "",
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      (data && typeof data === "object" && (data.message || data.error)) ||
        (typeof data === "string" && data) ||
        `Request failed: ${response.status}`
    );
  }

  return data;
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [page, setPage] = useState("dashboard");
  const [repairs, setRepairs] = useState([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [adminForm, setAdminForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  async function loadRepairs() {
    setLoading(true);
    try {
      const data = await request(API);
      setRepairs(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e.message || "Unable to load repairs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    request(`${AUTH}/session`)
      .then((data) => {
        const active =
          data?.authenticated === true ||
          data?.loggedIn === true ||
          Boolean(data?.username || data?.principal);

        setLoggedIn(active);
        setUsername(data?.username || data?.principal || "");
      })
      .catch(() => {
        setLoggedIn(false);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadRepairs();
    }
  }, [loggedIn]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");

    try {
      const data = await request(`${AUTH}/login`, {
        method: "POST",
        body: JSON.stringify({
          username: loginName.trim(),
          password: loginPassword,
        }),
      });

      setUsername(data?.username || loginName.trim());
      setLoggedIn(true);
      setLoginPassword("");
      setPage("dashboard");
    } catch (e) {
      setLoginError(e.message || "Login failed.");
    }
  }

  async function handleLogout() {
    try {
      await request(`${AUTH}/logout`, { method: "POST" });
    } catch {
      // The local interface still returns to login.
    }

    setLoggedIn(false);
    setUsername("");
    setRepairs([]);
    setPage("dashboard");
    setLoginName("");
    setLoginPassword("");
    setError("");
    setMessage("");
  }

  function openNewRepair() {
    setForm({ ...EMPTY });
    setEditingId(null);
    setError("");
    setMessage("");
    setPage("repairs");
  }

  function editRepair(repair) {
    setEditingId(repair.id);
    setForm({
      customer: repair.customer || "",
      device: repair.device || "",
      issue: repair.issue || "",
      status: repair.status || "PENDING",
      cost: repair.cost == null ? "" : String(repair.cost),
    });
    setError("");
    setMessage("");
    setPage("repairs");
  }

  async function saveRepair(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (
      !form.customer.trim() ||
      !form.device.trim() ||
      !form.issue.trim()
    ) {
      setError("Please complete the customer, device, and issue fields.");
      return;
    }

    if (form.cost !== "" && Number(form.cost) < 0) {
      setError("Cost cannot be negative.");
      return;
    }

    const payload = {
      customer: form.customer.trim(),
      device: form.device.trim(),
      issue: form.issue.trim(),
      status: form.status,
      cost: form.cost === "" ? null : Number(form.cost),
    };

    try {
      await request(
        editingId == null ? API : `${API}/${editingId}`,
        {
          method: editingId == null ? "POST" : "PUT",
          body: JSON.stringify(payload),
        }
      );

      setForm({ ...EMPTY });
      setEditingId(null);
      setMessage("Repair saved successfully.");
      await loadRepairs();
    } catch (e) {
      setError(e.message || "Unable to save repair.");
    }
  }

  async function deleteRepair(repair) {
    if (!window.confirm(`Delete repair #${repair.id}?`)) return;

    try {
      await request(`${API}/${repair.id}`, { method: "DELETE" });
      setMessage("Repair deleted successfully.");
      setError("");
      await loadRepairs();
    } catch (e) {
      setError(e.message || "Unable to delete repair.");
    }
  }

  async function registerAdmin(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (
      !adminForm.username.trim() ||
      !adminForm.email.trim() ||
      adminForm.password.length < 8
    ) {
      setError("Enter a username, valid email, and password of at least 8 characters.");
      return;
    }

    try {
      await request(`${AUTH}/register`, {
        method: "POST",
        body: JSON.stringify({
          username: adminForm.username.trim(),
          email: adminForm.email.trim(),
          password: adminForm.password,
        }),
      });

      setAdminForm({ username: "", email: "", password: "" });
      setMessage("Admin registered successfully.");
    } catch (e) {
      setError(e.message || "Unable to register admin.");
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (
      !passwordForm.currentPassword ||
      passwordForm.newPassword.length < 8 ||
      passwordForm.newPassword !== passwordForm.confirmPassword
    ) {
      setError("Check the current password, new password length, and confirmation.");
      return;
    }

    try {
      await request(`${AUTH}/password`, {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      await handleLogout();
      setLoginError("Password changed. Please log in using your new password.");
    } catch (e) {
      setError(e.message || "Unable to change password.");
    }
  }

  const visibleRepairs = repairs.filter((r) => {
    const term = search.toLowerCase().trim();
    const matchesStatus = filter === "ALL" || r.status === filter;
    const searchable = [
      r.id,
      r.customer,
      r.device,
      r.issue,
      r.status,
    ]
      .map((v) => String(v ?? "").toLowerCase())
      .join(" ");

    return matchesStatus && (!term || searchable.includes(term));
  });

  if (checking) {
    return <div className="app-message">Checking login session…</div>;
  }

  if (!loggedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Smart Repair Hub</h1>
          <p>Sign in to manage repair requests.</p>

          {loginError && <p className="error-message">{loginError}</p>}

          <form onSubmit={handleLogin}>
            <label>Username or email</label>
            <input
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoComplete="username"
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>Repair Hub</h2>
        <button onClick={() => setPage("dashboard")}>Dashboard</button>
        <button onClick={() => setPage("repairs")}>Repair Management</button>
        <button onClick={() => setPage("register")}>Register Admin</button>
        <button onClick={() => setPage("password")}>Change Password</button>
        <button onClick={handleLogout}>Logout</button>
        <small>Signed in as {username || "Admin"}</small>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <h1>
            {page === "dashboard"
              ? "Dashboard"
              : page === "repairs"
              ? "Repair Management"
              : page === "register"
              ? "Register Admin"
              : "Change Password"}
          </h1>
          <button type="button" onClick={openNewRepair}>
            + New Repair
          </button>
        </header>

        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        {page === "dashboard" && (
          <section className="dashboard-section">
            <h2>Welcome to Repair Hub</h2>
            <div className="stats-grid">
              <article>
                <h3>Total Repairs</h3>
                <strong>{repairs.length}</strong>
              </article>
              <article>
                <h3>Pending</h3>
                <strong>{repairs.filter((r) => r.status === "PENDING").length}</strong>
              </article>
              <article>
                <h3>In Progress</h3>
                <strong>{repairs.filter((r) => r.status === "IN_PROGRESS").length}</strong>
              </article>
              <article>
                <h3>Completed</h3>
                <strong>{repairs.filter((r) => r.status === "COMPLETED").length}</strong>
              </article>
            </div>

            <button type="button" onClick={() => setPage("repairs")}>
              View Repairs
            </button>
          </section>
        )}

        {page === "repairs" && (
          <section>
            <div className="toolbar">
              <input
                placeholder="Search repairs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>

              <button type="button" onClick={loadRepairs} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <p>{visibleRepairs.length} matching request(s)</p>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Device</th>
                    <th>Issue</th>
                    <th>Status</th>
                    <th>Cost</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRepairs.map((repair) => (
                    <tr key={repair.id}>
                      <td>{repair.id}</td>
                      <td>{repair.customer}</td>
                      <td>{repair.device}</td>
                      <td>{repair.issue}</td>
                      <td>
                        {{
                          PENDING: "Pending",
                          IN_PROGRESS: "In Progress",
                          COMPLETED: "Completed",
                        }[repair.status] || repair.status}
                      </td>
                      <td>{repair.cost == null ? "—" : `₹${repair.cost}`}</td>
                      <td>
                        <button type="button" onClick={() => editRepair(repair)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteRepair(repair)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && visibleRepairs.length === 0 && (
                <p>No matching repairs found.</p>
              )}
            </div>
                        <div className="repair-form-panel">
              <h2>{editingId == null ? "New Repair Request" : "Edit Repair Request"}</h2>

              <form onSubmit={saveRepair}>
                <label>Customer Name</label>
                <input
                  value={form.customer}
                  onChange={(e) =>
                    setForm({ ...form, customer: e.target.value })
                  }
                  placeholder="Enter customer name"
                  required
                />

                <label>Device</label>
                <input
                  value={form.device}
                  onChange={(e) =>
                    setForm({ ...form, device: e.target.value })
                  }
                  placeholder="Enter device"
                  required
                />

                <label>Issue Description</label>
                <textarea
                  value={form.issue}
                  onChange={(e) =>
                    setForm({ ...form, issue: e.target.value })
                  }
                  placeholder="Describe the issue"
                  required
                />

                <label>Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>

                <label>Repair Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) =>
                    setForm({ ...form, cost: e.target.value })
                  }
                  placeholder="Enter cost"
                />

                <div className="form-actions">
                  <button type="submit">
                    {editingId == null ? "Create Repair" : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...EMPTY });
                      setEditingId(null);
                      setError("");
                      setMessage("");
                    }}
                  >
                    Clear Form
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {page === "register" && (
          <section className="settings-panel">
            <h2>Register Admin</h2>
            <p>Create another administrator account.</p>

            <form onSubmit={registerAdmin}>
              <label>Username</label>
              <input
                value={adminForm.username}
                onChange={(e) =>
                  setAdminForm({ ...adminForm, username: e.target.value })
                }
                required
              />

              <label>Email</label>
              <input
                type="email"
                value={adminForm.email}
                onChange={(e) =>
                  setAdminForm({ ...adminForm, email: e.target.value })
                }
                required
              />

              <label>Password (minimum 8 characters)</label>
              <input
                type="password"
                minLength="8"
                value={adminForm.password}
                onChange={(e) =>
                  setAdminForm({ ...adminForm, password: e.target.value })
                }
                required
              />

              <button type="submit">Register Admin</button>
            </form>
          </section>
        )}

        {page === "password" && (
          <section className="settings-panel">
            <h2>Change Password</h2>
            <p>Choose a new password with at least 8 characters.</p>

            <form onSubmit={changePassword}>
              <label>Current Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
                required
              />

              <label>New Password</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength="8"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                required
              />

              <label>Confirm New Password</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength="8"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                required
              />

              <button type="submit">Change Password</button>
            </form>
          </section>
        )}

        <footer className="app-footer">
          Smart Repair Hub — Repair Management System
        </footer>
      </main>
    </div>
  );
}

export default App;