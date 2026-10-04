import { useState, useEffect } from 'react'
import api from './api'

const LOGIN_URL = '/api/auth/login'
const empty = { product_name: '', description: '', price: '', quantity: '' }
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const getMessage = (err, fallback) => {
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Please check that the API is running.'
  const d = err.response?.data
  if (d?.errors) return Object.values(d.errors).flat().join(', ')
  return d?.error || d?.message || fallback
}

function Toast({ toast, onClose }) {
  if (!toast) return null
  return (
    <div className={`toast ${toast.type}`} role="alert">
      <span className="toast-icon">{toast.type === 'success' ? '✓' : '!'}</span>
      <span>{toast.message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Close">×</button>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('access_token'))
  const [creds, setCreds] = useState({ login: '', password: '' })
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState(null)
  const [toast, setToast] = useState(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const notify = (type, message) => setToast({ type, message })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const clearSession = () => {
    localStorage.removeItem('access_token')
    setToken(null)
    setProducts([])
    setForm(empty)
    setEditingId(null)
    setConfirmId(null)
  }

  const handleLogout = () => {
    clearSession()
    notify('success', 'You have been logged out.')
  }

  const handleError = (err, fallback) => {
    if (err.response?.status === 401) {
      clearSession()
      notify('error', 'Your session has expired. Please log in again.')
      return
    }
    notify('error', getMessage(err, fallback))
  }

  const loadProducts = async () => {
    setLoadingList(true)
    try {
      const res = await api.get('/api/products')
      const data = res.data.data
      setProducts(Array.isArray(data) ? data : Object.values(data || {}))
    } catch (err) {
      handleError(err, 'Failed to load products.')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (token) loadProducts()
  }, [token])

  const login = async (e) => {
    e.preventDefault()
    if (!creds.login.trim() || !creds.password) {
      notify('error', 'Please enter your username/email and password.')
      return
    }
    setLoggingIn(true)
    try {
      const res = await api.post(LOGIN_URL, creds)
      const t = res.data.tokens.access_token
      localStorage.setItem('access_token', t)
      setToken(t)
      setCreds({ login: '', password: '' })
      notify('success', 'Login successful. Welcome!')
    } catch (err) {
      notify('error', getMessage(err, 'Login failed. Please check your credentials.'))
    } finally {
      setLoggingIn(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/api/products/${editingId}`, form)
        notify('success', 'Product updated successfully.')
      } else {
        await api.post('/api/products', form)
        notify('success', 'Product added successfully.')
      }
      setForm(empty)
      setEditingId(null)
      await loadProducts()
    } catch (err) {
      handleError(err, 'Failed to save the product.')
    } finally {
      setSaving(false)
    }
  }

  const edit = (p) => {
    setEditingId(p.id)
    setForm({
      product_name: p.product_name,
      description: p.description || '',
      price: p.price,
      quantity: p.quantity,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(empty)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/api/products/${confirmId}`)
      notify('success', 'Product deleted successfully.')
      if (editingId === confirmId) cancelEdit()
      setConfirmId(null)
      await loadProducts()
    } catch (err) {
      setConfirmId(null)
      handleError(err, 'Failed to delete the product.')
    } finally {
      setDeleting(false)
    }
  }

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  /* ============ LOGIN PAGE ============ */
  if (!token) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="logo">📦</div>
          <h1>Welcome back</h1>
          <p className="sub">Log in to manage your products</p>
          <form onSubmit={login}>
            <label>
              Username or Email
              <input
                placeholder="Enter your username or email"
                value={creds.login}
                onChange={(e) => setCreds({ ...creds, login: e.target.value })}
                disabled={loggingIn}
                autoFocus
              />
            </label>
            <label>
              Password
              <input
                type="password"
                placeholder="Enter your password"
                value={creds.password}
                onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                disabled={loggingIn}
              />
            </label>
            <button type="submit" className="btn primary block" disabled={loggingIn}>
              {loggingIn ? (<><span className="spinner" /> Logging in...</>) : 'Log in'}
            </button>
            {loggingIn && <p className="hint">This may take a few seconds, please wait.</p>}
          </form>
        </div>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    )
  }

  /* ============ PRODUCT PAGE ============ */
  const totalStock = products.reduce((s, p) => s + Number(p.quantity || 0), 0)
  const totalValue = products.reduce((s, p) => s + Number(p.price || 0) * Number(p.quantity || 0), 0)

  return (
    <div className="page">
      <header className="navbar">
        <div className="nav-inner">
          <div className="brand">📦 Product Manager</div>
          <button className="btn ghost-light" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="container">
        <section className="stats">
          <div className="stat"><span>Total products</span><strong>{products.length}</strong></div>
          <div className="stat"><span>Total stock</span><strong>{totalStock}</strong></div>
          <div className="stat"><span>Inventory value</span><strong>{money.format(totalValue)}</strong></div>
        </section>

        <section className="card">
          <h2>{editingId ? `Edit product #${editingId}` : 'Add new product'}</h2>
          <form onSubmit={save} className="grid-form">
            <label className="span-2">
              Product name
              <input name="product_name" placeholder="e.g. Wireless Mouse" value={form.product_name}
                onChange={change} required disabled={saving} />
            </label>
            <label className="span-2">
              Description
              <input name="description" placeholder="Short description" value={form.description}
                onChange={change} disabled={saving} />
            </label>
            <label>
              Price (PHP)
              <input name="price" type="number" step="0.01" min="0" placeholder="0.00" value={form.price}
                onChange={change} required disabled={saving} />
            </label>
            <label>
              Quantity
              <input name="quantity" type="number" min="0" step="1" placeholder="0" value={form.quantity}
                onChange={change} required disabled={saving} />
            </label>
            <div className="form-actions span-2">
              <button type="submit" className="btn primary" disabled={saving}>
                {saving
                  ? (<><span className="spinner" /> Saving...</>)
                  : editingId ? 'Update product' : 'Add product'}
              </button>
              {editingId && (
                <button type="button" className="btn ghost" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Products <span className="badge">{products.length}</span></h2>
            {loadingList && products.length > 0 && <span className="spinner dark" />}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Description</th>
                  <th className="num">Price</th><th className="num">Qty</th><th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingList && products.length === 0 && [1, 2, 3].map((n) => (
                  <tr key={n} className="skeleton-row">
                    {[1, 2, 3, 4, 5, 6].map((c) => <td key={c}><div className="skeleton" /></td>)}
                  </tr>
                ))}

                {!loadingList && products.length === 0 && (
                  <tr><td colSpan="6" className="empty">No products yet. Add your first product above.</td></tr>
                )}

                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td className="strong">{p.product_name}</td>
                    <td className="muted">{p.description || '—'}</td>
                    <td className="num">{money.format(Number(p.price))}</td>
                    <td className="num">{p.quantity}</td>
                    <td className="actions">
                      <button className="btn small warn" onClick={() => edit(p)}>Edit</button>
                      <button className="btn small danger" onClick={() => setConfirmId(p.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {confirmId && (
        <div className="overlay" onClick={() => !deleting && setConfirmId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete product?</h3>
            <p>This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setConfirmId(null)} disabled={deleting}>Cancel</button>
              <button className="btn danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? (<><span className="spinner" /> Deleting...</>) : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
