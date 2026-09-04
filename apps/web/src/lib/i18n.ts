type Locale = 'en' | 'mr' | 'hi'

const dict = {
  en: {
    'app.name': 'Pāvati Pustak',
    'app.tagline': 'Digital Trust, Donation & Receipt Management',
    'nav.dashboard': 'Dashboard',
    'nav.donations': 'Donations',
    'nav.receipts': 'Receipts',
    'nav.members': 'Members',
    'nav.announcements': 'Announcements',
    'nav.campaigns': 'Campaigns',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'nav.profile': 'Profile',
    'nav.notifications': 'Notifications',
    'action.donate': 'Donate',
    'action.create': 'Create',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.submit': 'Submit',
    'action.confirm': 'Confirm',
    'action.search': 'Search',
    'action.viewAll': 'View all',
    'action.download': 'Download',
    'action.share': 'Share',
    'action.copy': 'Copy',
    'action.copyLink': 'Copy link',
    'action.generate': 'Generate',
    'action.activate': 'Activate',
    'action.void': 'Void',
    'action.print': 'Print',
    'action.invite': 'Invite',
    'common.loading': 'Loading…',
    'common.noData': 'No data to show yet',
    'common.error': 'Something went wrong. Please try again.',
    'common.confirm': 'Are you sure?',
    'common.optional': 'Optional',
    'common.required': 'Required',
    'common.total': 'Total',
    'common.today': 'Today',
    'common.seeMore': 'See more',
    'common.all': 'All',
    'common.currency': '₹',
  },
  mr: {
    'app.name': 'पावती पुस्तक',
    'app.tagline': 'डिजिटल ट्रस्ट, देणगी आणि पावती व्यवस्थापन',
    'nav.dashboard': 'डॅशबोर्ड',
    'nav.donations': 'देणग्या',
    'nav.receipts': 'पावत्या',
    'nav.members': 'सदस्य',
    'nav.announcements': 'सूचना',
    'nav.campaigns': 'मोहिमा',
    'nav.reports': 'अहवाल',
    'nav.settings': 'सेटिंग्ज',
    'nav.profile': 'प्रोफाइल',
    'action.donate': 'देणगी द्या',
    'action.create': 'तयार करा',
    'action.save': 'जतन करा',
    'action.cancel': 'रद्द करा',
    'action.back': 'मागे',
    'action.next': 'पुढे',
    'action.submit': 'सबमिट करा',
    'action.search': 'शोधा',
    'action.download': 'डाउनलोड',
    'action.share': 'शेअर',
    'common.loading': 'लोड होत आहे…',
    'common.noData': 'अद्याप कोणताही डेटा नाही',
    'common.total': 'एकूण',
    'common.today': 'आज',
    'common.currency': '₹',
  },
  hi: {
    'app.name': 'पावती पुस्तक',
    'app.tagline': 'डिजिटल ट्रस्ट, दान और रसीद प्रबंधन',
    'nav.dashboard': 'डैशबोर्ड',
    'nav.donations': 'दान',
    'nav.receipts': 'रसीदें',
    'nav.members': 'सदस्य',
    'nav.announcements': 'सूचनाएं',
    'nav.campaigns': 'अभियान',
    'nav.reports': 'रिपोर्ट',
    'nav.settings': 'सेटिंग्स',
    'action.donate': 'दान करें',
    'action.create': 'बनाएं',
    'action.save': 'सहेजें',
    'action.cancel': 'रद्द करें',
    'action.back': 'वापस',
    'action.next': 'आगे',
    'action.submit': 'जमा करें',
    'action.search': 'खोजें',
    'action.download': 'डाउनलोड',
    'action.share': 'साझा करें',
    'common.loading': 'लोड हो रहा है…',
    'common.noData': 'अभी तक कोई डेटा नहीं',
    'common.total': 'कुल',
    'common.today': 'आज',
    'common.currency': '₹',
  },
} as const

type Dict = typeof dict.en
let current: Locale = 'en'

export function setLocale(locale: Locale) {
  current = locale
  if (typeof localStorage !== 'undefined') localStorage.setItem('pp_locale', locale)
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

export function getLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'en'
  return (localStorage.getItem('pp_locale') as Locale) || 'en'
}

export function t(key: keyof Dict): string {
  const d = dict[current] as Dict
  return (d[key] ?? dict.en[key] ?? key) as string
}

export const localeOptions: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'mr', label: 'मराठी' },
  { value: 'hi', label: 'हिन्दी' },
]