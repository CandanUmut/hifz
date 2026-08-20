import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section>
      <h1 className="text-large font-medium">Nothing here.</h1>
      <Link to="/" className="btn-secondary mt-6">
        Back to today
      </Link>
    </section>
  )
}
