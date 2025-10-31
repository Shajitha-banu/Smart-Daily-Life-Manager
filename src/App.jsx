import React, { useEffect, useState, useRef } from "react";

/*
 Smart Daily Life Manager - Single-file app (frontend-only)
 Stores data in localStorage under keys:
  - sdlm_users
  - sdlm_current_user
  - sdlm_grocery_<userEmail>
  - sdlm_expenses_<userEmail>
  - sdlm_notes_<userEmail>
  - sdlm_reminders_<userEmail>
  - sdlm_travels_<userEmail>
*/

const LS = {
  USERS: "sdlm_users",
  CURRENT: "sdlm_current_user",
};

function readLS(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function emailKey(prefix, email) {
  return `${prefix}_${email.replace(/\W/g, "")}`;
}

/* ---------- Auth helpers ---------- */
function registerUser({ name, email, phone, password, accountType }) {
  const users = readLS(LS.USERS, []);
  if (users.find((u) => u.email === email)) {
    throw new Error("Email already registered");
  }
  const user = { name, email, phone, password, accountType };
  users.push(user);
  writeLS(LS.USERS, users);
  writeLS(LS.CURRENT, user);
  return user;
}

function loginUser({ email, password }) {
  const users = readLS(LS.USERS, []);
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) throw new Error("Invalid email or password");
  writeLS(LS.CURRENT, user);
  return user;
}

function logoutUser() {
  localStorage.removeItem(LS.CURRENT);
}

/* ---------- Component ---------- */

export default function App() {
  const [currentUser, setCurrentUser] = useState(readLS(LS.CURRENT, null));
  const [view, setView] = useState(currentUser ? "dashboard" : "login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // user-specific stores
  const groceryKeyRef = useRef();
  const expenseKeyRef = useRef();
  const notesKeyRef = useRef();
  const remindersKeyRef = useRef();
  const travelsKeyRef = useRef();

  // per-user states
  const [grocery, setGrocery] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [travels, setTravels] = useState([]);

  // reminder polling
  useEffect(() => {
    const t = setInterval(() => {
      if (!currentUser) return;
      const rems = readLS(remindersKeyRef.current, []);
      const now = Date.now();
      // find reminders with time <= now and not shown
      rems.forEach((r) => {
        if (!r.shown && r.time && r.time <= now) {
          // browser notification (if allowed)
          if (window.Notification && Notification.permission === "granted") {
            new Notification(`Reminder: ${r.title}`, { body: r.desc || "" });
          } else {
            // fallback small alert (non-blocking)
            setMessage(`Reminder: ${r.title}`);
            setTimeout(() => setMessage(""), 4000);
          }
          r.shown = true;
        }
      });
      writeLS(remindersKeyRef.current, rems);
      setReminders(rems);
    }, 10_000);
    return () => clearInterval(t);
  }, [currentUser]);

  // when currentUser changes, load user-specific data keys
  useEffect(() => {
    if (!currentUser) return;
    const email = currentUser.email;
    groceryKeyRef.current = emailKey("sdlm_grocery", email);
    expenseKeyRef.current = emailKey("sdlm_expenses", email);
    notesKeyRef.current = emailKey("sdlm_notes", email);
    remindersKeyRef.current = emailKey("sdlm_reminders", email);
    travelsKeyRef.current = emailKey("sdlm_travels", email);

    setGrocery(readLS(groceryKeyRef.current, []));
    setExpenses(readLS(expenseKeyRef.current, []));
    setNotes(readLS(notesKeyRef.current, []));
    setReminders(readLS(remindersKeyRef.current, []));
    setTravels(readLS(travelsKeyRef.current, []));
    setView("dashboard");
  }, [currentUser]);

  // helper to save user data sets
  function saveGrocery(next) {
    setGrocery(next);
    writeLS(groceryKeyRef.current, next);
  }
  function saveExpenses(next) {
    setExpenses(next);
    writeLS(expenseKeyRef.current, next);
  }
  function saveNotes(next) {
    setNotes(next);
    writeLS(notesKeyRef.current, next);
  }
  function saveReminders(next) {
    setReminders(next);
    writeLS(remindersKeyRef.current, next);
  }
  function saveTravels(next) {
    setTravels(next);
    writeLS(travelsKeyRef.current, next);
  }

  /* ---------- Auth forms ---------- */
  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.name || !f.email || !f.password) {
      setMessage("Name, email and password are required");
      return;
    }
    try {
      setLoading(true);
      const user = registerUser({
        name: f.name,
        email: f.email,
        phone: f.phone || "",
        password: f.password,
        accountType: f.accountType || "Individual",
      });
      setCurrentUser(user);
      setMessage("Registered & logged in");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("");
    const f = Object.fromEntries(new FormData(e.target));
    try {
      setLoading(true);
      const user = loginUser({ email: f.email, password: f.password });
      setCurrentUser(user);
      setMessage("Login successful");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logoutUser();
    setCurrentUser(null);
    setView("login");
    setMessage("Logged out");
  }

  /* ---------- Grocery functions ---------- */
  function addGroceryItem(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.name) return;
    const item = {
      id: Date.now(),
      name: f.name,
      qty: f.qty || "",
      category: f.category || "",
      purchased: false,
    };
    const next = [item, ...grocery];
    saveGrocery(next);
    e.target.reset();
  }
  function togglePurchased(id) {
    const next = grocery.map((g) => (g.id === id ? { ...g, purchased: !g.purchased } : g));
    saveGrocery(next);
  }
  function deleteGrocery(id) {
    saveGrocery(grocery.filter((g) => g.id !== id));
  }

  /* ---------- Expenses ---------- */
  function addExpense(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.amount) return;
    const exp = {
      id: Date.now(),
      amount: parseFloat(f.amount),
      category: f.category || "Other",
      date: f.date || new Date().toISOString(),
      method: f.method || "Cash",
      note: f.note || "",
    };
    const next = [exp, ...expenses];
    saveExpenses(next);
    e.target.reset();
  }
  function deleteExpense(id) {
    saveExpenses(expenses.filter((x) => x.id !== id));
  }

  /* ---------- Notes ---------- */
  function addNote(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.text) return;
    const n = { id: Date.now(), text: f.text, important: f.important === "on" };
    const next = [n, ...notes];
    saveNotes(next);
    e.target.reset();
  }
  function deleteNote(id) {
    saveNotes(notes.filter((n) => n.id !== id));
  }

  /* ---------- Reminders ---------- */
  function addReminder(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.title || !f.time) return;
    const r = { id: Date.now(), title: f.title, desc: f.desc || "", time: new Date(f.time).getTime(), shown: false };
    const next = [r, ...reminders];
    saveReminders(next);
    e.target.reset();
  }
  function deleteReminder(id) {
    saveReminders(reminders.filter((r) => r.id !== id));
  }

  /* ---------- Travel entries & file preview ---------- */
  function addTravel(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const file = e.target.receipt?.files?.[0];
    const travel = {
      id: Date.now(),
      dest: f.dest || "",
      start: f.start || "",
      end: f.end || "",
      purpose: f.purpose || "",
      receiptName: file ? file.name : null,
      // store base64 preview for image files
      receiptPreview: null,
    };
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        travel.receiptPreview = ev.target.result;
        const next = [travel, ...travels];
        saveTravels(next);
      };
      reader.readAsDataURL(file);
    } else {
      const next = [travel, ...travels];
      saveTravels(next);
    }
    e.target.reset();
  }
  function deleteTravel(id) {
    saveTravels(travels.filter((t) => t.id !== id));
  }

  /* ---------- Utility UI ---------- */
  function formatDate(msOrIso) {
    const d = new Date(msOrIso);
    return d.toLocaleString();
  }

  /* ---------- Render ---------- */
  if (!currentUser) {
    return (
      <div className="page">
        <header className="top">Smart Daily Life Manager</header>
        <main className="center-card">
          <div className="card">
            <h3>Login</h3>
            <form onSubmit={handleLogin}>
              <input name="email" placeholder="Email" />
              <input name="password" type="password" placeholder="Password" />
              <div className="row">
                <button type="submit">Login</button>
                <button type="button" onClick={() => setView("register")}>Register</button>
              </div>
            </form>
            <p className="muted">Or register a new account</p>
            {message && <div className="msg">{message}</div>}
            {view === "register" && (
              <div className="card thin">
                <h3>Register</h3>
                <form onSubmit={handleRegister}>
                  <input name="name" placeholder="Full name" />
                  <input name="email" placeholder="Email" />
                  <input name="phone" placeholder="Phone (optional)" />
                  <input name="password" type="password" placeholder="Password" />
                  <select name="accountType" defaultValue="Individual">
                    <option>Individual</option>
                    <option>Family</option>
                  </select>
                  <div className="row">
                    <button type="submit">Create Account</button>
                    <button type="button" onClick={() => setView("login")}>Back</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
        <footer className="foot">© 2025 | Smart Daily Life Manager</footer>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="top">
        <div className="brand">Kambaa — Smart Daily Life Manager</div>
        <div className="right">
          <span className="muted">Welcome! </span><strong>{currentUser.name}</strong>
          <button className="small" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="container">
        <aside className="left">
          <div className="panel">
            <h4>Tasks & Features</h4>
            <ul className="menu">
              <li className={view==="dashboard"?"active":""} onClick={()=>setView("dashboard")}>Dashboard</li>
              <li className={view==="grocery"?"active":""} onClick={()=>setView("grocery")}>Grocery Lists</li>
              <li className={view==="expenses"?"active":""} onClick={()=>setView("expenses")}>Daily Expenses</li>
              <li className={view==="notes"?"active":""} onClick={()=>setView("notes")}>Personal Notes</li>
              <li className={view==="reminders"?"active":""} onClick={()=>setView("reminders")}>Reminders</li>
              <li className={view==="travel"?"active":""} onClick={()=>setView("travel")}>Travel History</li>
            </ul>
          </div>
        </aside>

        <section className="right">
          {message && <div className="msg">{message}</div>}

          {view==="dashboard" && (
            <div className="card">
              <h2>Smart Daily Life Manager</h2>
              <p className="muted">Add groceries, track expenses, create reminders and log travels — everything in one place.</p>
              <div className="grid">
                <div className="tile" onClick={()=>setView("grocery")}>🛒 Grocery</div>
                <div className="tile" onClick={()=>setView("expenses")}>💰 Expenses</div>
                <div className="tile" onClick={()=>setView("notes")}>🗒️ Notes</div>
                <div className="tile" onClick={()=>setView("reminders")}>⏰ Reminders</div>
                <div className="tile" onClick={()=>setView("travel")}>✈️ Travel</div>
              </div>
            </div>
          )}

          {view==="grocery" && (
            <div className="card">
              <h3>Grocery Lists</h3>
              <form onSubmit={addGroceryItem} className="inline-form">
                <input name="name" placeholder="Item name" />
                <input name="qty" placeholder="Quantity" />
                <input name="category" placeholder="Category" />
                <button>Add</button>
              </form>
              <ul className="list">
                {grocery.map(g => (
                  <li key={g.id} className={g.purchased?"purchased":""}>
                    <div><strong>{g.name}</strong> {g.qty && <span className="muted">• {g.qty}</span>}</div>
                    <div className="actions">
                      <button onClick={()=>togglePurchased(g.id)}>{g.purchased ? "Unmark":"Mark"}</button>
                      <button onClick={()=>deleteGrocery(g.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view==="expenses" && (
            <div className="card">
              <h3>Daily Expenses</h3>
              <form onSubmit={addExpense} className="inline-form">
                <input name="amount" placeholder="Amount" type="number" step="0.01" />
                <input name="category" placeholder="Category" />
                <input name="date" placeholder="Date (optional)" type="date" />
                <select name="method">
                  <option>Cash</option><option>Card</option><option>UPI</option><option>Other</option>
                </select>
                <input name="note" placeholder="Note (optional)" />
                <button>Add</button>
              </form>
              <div className="muted">Total: ₹{expenses.reduce((s,e)=>s+(e.amount||0),0).toFixed(2)}</div>
              <ul className="list">
                {expenses.map(exp => (
                  <li key={exp.id}>
                    <div><strong>₹{exp.amount}</strong> <span className="muted">• {exp.category} • {new Date(exp.date).toLocaleDateString()}</span></div>
                    <div className="actions"><button onClick={()=>deleteExpense(exp.id)}>Delete</button></div>
                    {exp.note && <div className="muted">Note: {exp.note}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view==="notes" && (
            <div className="card">
              <h3>Personal Notes</h3>
              <form onSubmit={addNote}>
                <input name="text" placeholder="Write a quick note" />
                <label className="inline"><input name="important" type="checkbox" /> Mark important</label>
                <button>Add Note</button>
              </form>
              <ul className="list">
                {notes.map(n=>(
                  <li key={n.id}>
                    <div>{n.text} {n.important && <span className="tag">Important</span>}</div>
                    <div className="actions"><button onClick={()=>deleteNote(n.id)}>Delete</button></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view==="reminders" && (
            <div className="card">
              <h3>Reminders</h3>
              <form onSubmit={addReminder}>
                <input name="title" placeholder="Reminder title" />
                <input name="desc" placeholder="Description (optional)" />
                <input name="time" type="datetime-local" />
                <button>Add Reminder</button>
              </form>
              <ul className="list">
                {reminders.map(r => (
                  <li key={r.id}>
                    <div><strong>{r.title}</strong> <span className="muted">• {r.time ? formatDate(r.time) : ''}</span></div>
                    <div className="actions"><button onClick={()=>deleteReminder(r.id)}>Delete</button></div>
                    {r.desc && <div className="muted">{r.desc}</div>}
                  </li>
                ))}
              </ul>
              <div className="muted">Tip: Allow browser notifications to get alerts while app is open.</div>
              <div style={{marginTop:8}}><button onClick={()=>{
                if(window.Notification && Notification.permission!=="granted") Notification.requestPermission().then(()=>setMessage("Notification permission updated"));
              }}>Enable Notifications</button></div>
            </div>
          )}

          {view==="travel" && (
            <div className="card">
              <h3>Travel History & Receipts</h3>
              <form onSubmit={addTravel} className="inline-form">
                <input name="dest" placeholder="Destination" />
                <input name="start" type="date" />
                <input name="end" type="date" />
                <input name="purpose" placeholder="Purpose" />
                <input name="receipt" type="file" accept="image/*,application/pdf" />
                <button>Add Travel</button>
              </form>
              <ul className="list">
                {travels.map(t=>(
                  <li key={t.id}>
                    <div><strong>{t.dest}</strong> <span className="muted">• {t.start} → {t.end}</span></div>
                    <div className="muted">{t.purpose}</div>
                    {t.receiptName && <div className="muted">Receipt: {t.receiptName}</div>}
                    {t.receiptPreview && <img src={t.receiptPreview} alt="receipt" style={{maxWidth:200,marginTop:6,borderRadius:6}} />}
                    <div className="actions"><button onClick={()=>deleteTravel(t.id)}>Delete</button></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </section>
      </main>

      <footer className="foot">© 2025 Smart Daily Life Manager</footer>
    </div>
  );
}
