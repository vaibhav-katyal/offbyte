import { useMemo, useState, useEffect } from 'react';
import './App.css'

const API_URL = 'http://localhost:5000/api';

function App() {
  const [products, setProducts] = useState([])
  

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`);
      const payload = await res.json();
      setProducts(payload.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);const [users, setUsers] = useState([])

  

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      const payload = await res.json();
      setUsers(payload.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);const [newProduct, setNewProduct] = useState({ name: '', price: '', category: '' })
  const [newUser, setNewUser] = useState({ name: '', role: '' })
  const [search, setSearch] = useState('')

  const filteredProducts = useMemo(() => {
    const key = search.trim().toLowerCase()
    if (!key) return products
    return products.filter((item) => item.name.toLowerCase().includes(key))
  }, [products, search])

  const totalValue = useMemo(() => {
    return products.reduce((sum, item) => sum + Number(item.price || 0), 0)
  }, [products])

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.category) return;

    try {
      const res = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });

      if (res.ok) {
        await fetchProducts();
        setNewProduct({ name: '', price: '', category: '' });
      }
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.role) return;

    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        await fetchUsers();
        setNewUser({ name: '', role: '' });
      }
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

const deleteProduct = async (id) => {
    try {
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

const deleteUser = async (id) => {
    try {
      const res = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

return (
    <main className="app">
      <header className="hero">
        <p className="tag">Full Stack</p>
        <h1>Product & User Management</h1>
        <p className="subtext">
          Simple React app with local state management.
        </p>
      </header>

      <section className="stats">
        <article>
          <p>Total Products</p>
          <h2>{products.length}</h2>
        </article>
        <article>
          <p>Total Users</p>
          <h2>{users.length}</h2>
        </article>
        <article>
          <p>Inventory Value</p>
          <h2>Rs {totalValue}</h2>
        </article>
      </section>

      <section className="grid">
        <div className="card">
          <h3>Add Product</h3>
          <form onSubmit={handleProductSubmit} className="form">
            <input
              placeholder="Product name"
              value={newProduct.name}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              placeholder="Price"
              type="number"
              value={newProduct.price}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, price: e.target.value }))}
            />
            <input
              placeholder="Category"
              value={newProduct.category}
              onChange={(e) => setNewProduct((prev) => ({ ...prev, category: e.target.value }))}
            />
            <button type="submit">Add Product</button>
          </form>
        </div>

        <div className="card">
          <h3>Add User</h3>
          <form onSubmit={handleUserSubmit} className="form">
            <input
              placeholder="User name"
              value={newUser.name}
              onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              placeholder="Role"
              value={newUser.role}
              onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value }))}
            />
            <button type="submit">Add User</button>
          </form>
        </div>
      </section>

      <section className="list-section">
        <div className="list-header">
          <h3>Products List</h3>
          <input
            className="search"
            placeholder="Search product"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>


        <ul className="list">
          {filteredProducts.map((item) => (
            <li key={item._id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.category}</p>
              </div>
              <div className="row-actions">
                <span>Rs {item.price}</span>
                <button onClick={() => deleteProduct(item._id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="list-section">
        <h3>Users List</h3>
        <ul className="list">
          {users.map((item) => (
            <li key={item._id}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.role}</p>
              </div>
              <button onClick={() => deleteUser(item._id)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App
