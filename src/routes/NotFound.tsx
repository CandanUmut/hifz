import { Link } from 'react-router-dom'
import { useT } from '@/i18n'

export default function NotFound() {
  const t = useT()
  return (
    <section>
      <h1 className="text-large font-medium">{t('common.notFound')}</h1>
      <Link to="/" className="btn-secondary mt-6">
        {t('review.backToToday')}
      </Link>
    </section>
  )
}
