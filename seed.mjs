// T-21 — Demo seeder. Uses ONLY the API, never SQL (data-model.md §9).
// Requires Node 18+ (built-in fetch). Usage:
//   API_URL=http://localhost:8000/api/v1 ADMIN_USERNAME=... ADMIN_PASSWORD=... node seed.mjs
const API = process.env.API_URL || 'http://localhost:8000/api/v1'
const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env

const BOOKS = 40
const MEMBERS = 10
const LOANS = 15

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD.')
  process.exit(1)
}

let token = null

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data?.code ?? ''} ${data?.message ?? ''}`)
  return data
}

// Distinct 13-digit ISBNs per run, so the seeder can run more than once.
const runPrefix = String(Date.now()).slice(-6)
const isbn = (n) => `978${runPrefix}${String(n).padStart(4, '0')}`

const TITLES = ['El jardín', 'La montaña', 'El río', 'La ciudad', 'El viaje', 'La memoria', 'El faro', 'La isla']
const AUTHORS = ['Ana Torres', 'Luis Gómez', 'María Rojas', 'Carlos Díaz', 'Lucía Ramírez']

async function main() {
  const login = await call('POST', '/auth/login', { username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
  token = login.access_token
  console.log('Logged in as', login.role)

  const categories = await call('GET', '/categories')

  const books = []
  for (let i = 1; i <= BOOKS; i++) {
    books.push(await call('POST', '/books', {
      title: `${TITLES[i % TITLES.length]} ${i}`,
      author: AUTHORS[i % AUTHORS.length],
      isbn: isbn(i),
      category_id: categories[i % categories.length].id,
      total_copies: 3,
    }))
  }
  console.log(`Books created: ${books.length}`)

  const members = []
  for (let i = 1; i <= MEMBERS; i++) {
    members.push(await call('POST', '/members', {
      full_name: `Socio de demostración ${i}`,
      document_number: `${runPrefix}${String(i).padStart(3, '0')}`,
    }))
  }
  console.log(`Members created: ${members.length}`)

  // 15 loans of one book each: no member goes above 3 unreturned books (RN-2).
  const loans = []
  for (let i = 0; i < LOANS; i++) {
    loans.push(await call('POST', '/loans', {
      member_id: members[i % MEMBERS].id,
      items: [{ book_id: books[i].id }],
    }))
  }
  console.log(`Loans created: ${loans.length}`)

  // Return a few lines so the list shows closed loans too.
  for (const loan of loans.slice(0, 3)) {
    await call('POST', `/loans/${loan.id}/items/${loan.items[0].id}/return`)
  }
  console.log('Returned: 3 lines')

  const today = new Date().toISOString().slice(0, 10)
  const report = await call('GET', `/reports/most-borrowed?from=${today}&to=${today}`)
  console.log(`Report rows for today: ${report.rows.length}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
