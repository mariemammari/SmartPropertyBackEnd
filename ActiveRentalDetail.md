import { useEffect, useMemo, useRef, useState } from 'react';
import { FiInfo } from 'react-icons/fi';
import { FiDroplet, FiLayers, FiMaximize2 } from 'react-icons/fi';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import {
  FiArrowLeft,
  FiUser,
  FiFileText,
  FiDollarSign,
  FiTrendingUp,
  FiHome,
  FiRefreshCw,
  FiUserCheck,
  FiZap,
  FiMessageSquare,
  FiCalendar,
  FiFolder,
  FiEye,
  FiImage
} from 'react-icons/fi';
import { getProperty, getPropertyMedia, getActiveListing, updateListing, deleteProperty } from '../../api/propertyApi';
import { getRentalById, getRentalsByProperty, getRentalPaymentSchedule } from '../../api/rentalApi';
import { getUser } from '../../api/userApi';
import { getBranchById } from '../../api/branchApi';
import InfoIcon from '../../components/InfoIcon';
import { getInvoicePaymentBadge, getBadgeClasses } from '../../services/invoicePaymentBadge';
import {
  createBulkPayment,
  createOfflinePayment,
  createPaymentIntent,
  getRentalPaymentTracking,
  createTranchedPayment,
} from '../../api/rental-payments.api';
import {
  createRentalChatSocketWithNamespace,
  extractConversationId,
  extractConversationIds,
  getRentalConversations,
  getRentalConversationMessages,
  joinRentalConversationSocket,
  RENTAL_CHAT_CONVERSATION_TYPES,
  sendRentalConversationMessage,
  sendRentalSocketMessage,
  startRentalConversation,
} from '../../api/rentalChatApi';
import { useAuth } from '../../contexts/AuthContext';
import {
  archiveRentalContract,
  createRentalContract,
  createRentalDocument,
  deleteRentalDocument,
  getContractDownload,
  getLatestRentalContract,
  getRentalContracts,
  getRentalDocuments,
  getDocumentDownload,
  signRentalContract,
} from '../../api/rentalDocumentsApi';
import { uploadContractPdfToCloudinary, uploadSignatureImageToCloudinary } from '../../integrations/cloudinaryApi';
// InfoTooltip component
const InfoTooltip = ({ text }) => (
  <div className="group relative inline-block ml-1 cursor-help">
    <FiInfo className="w-3.5 h-3.5 text-app_grey hover:text-app_blue transition-colors" />
    <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-app_blue text-white text-xs rounded whitespace-nowrap z-50">
      {text}
    </div>
  </div>
);


const PersonCard = ({ title, person }) => {
  const fullNameText = String(person?.fullName || `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || '').trim();
  const photoUrl = person?.photo || person?.profilePicture || person?.avatar || person?.profilePhotoUrl || '';
  const addressText = [person?.city, person?.state].filter(Boolean).join(', ') || person?.address || '-';
  const email = person?.email || '';

  // Handle string IDs or missing data
  if (!person || typeof person === 'string') {
    return (
      <div className="flex flex-col items-center p-4 bg-white rounded-lg border border-app_lightGrey">
        <div className="w-16 h-16 rounded-full bg-app_grey/10 flex items-center justify-center mb-2">
          <span className="text-xs text-app_grey font-semibold">TBA</span>
        </div>
        <p className="text-sm font-semibold text-app_grey text-center">Not Available</p>
        <p className="text-xs text-app_grey/50 text-center mt-1">-</p>
        <p className="text-xs text-app_grey/60 uppercase tracking-wider mt-2">{title}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-lg border border-app_lightGrey hover:shadow-sm transition-shadow">
      {photoUrl ? (
        <img src={photoUrl} alt={fullNameText || title} className="w-16 h-16 rounded-full object-cover mb-2" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-app_blue/10 flex items-center justify-center mb-2">
          <span className="text-2xl font-bold text-app_blue">{fullNameText.charAt(0) || title.charAt(0) || '?'}</span>
        </div>
      )}
      <p className="text-sm font-semibold text-app_blue text-center">{fullNameText || 'N/A'}</p>
      <p className="text-xs text-app_grey text-center mt-1">{addressText}</p>
      <p className="text-xs text-app_grey text-center mt-1 break-all">{email || 'No email'}</p>
      <p className="text-xs text-app_grey/60 uppercase tracking-wider mt-2 text-center">{title}</p>
    </div>
  );
};

const TYPE_LABELS = {
  apartment: 'Apartment', villa: 'Villa', house: 'House', studio: 'Studio',
  duplex: 'Duplex', office: 'Office', commercial: 'Commercial', land: 'Land',
  garage: 'Garage', warehouse: 'Warehouse',
};

const sectionTabs = [
  { name: 'Overview', icon: FiEye },
  { name: 'Payments', icon: FiDollarSign },
  { name: 'Documents', icon: FiFolder },
  { name: 'Chat', icon: FiMessageSquare },
  { name: 'Performance', icon: FiTrendingUp },

  { name: 'Renewal / Exit', icon: FiRefreshCw },
  { name: 'Tenant Profile', icon: FiUserCheck },
  { name: 'Quick Actions', icon: FiZap },
];

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY, { advancedFraudSignals: false })
  : null;

const PAYMENT_METHODS = {
  STRIPE: 'stripe',
  CASH: 'cash',
  CHEQUE: 'cheque',
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  VERIFIED: 'verified',
  FAILED: 'failed',
};

const PAYMENT_STATUS_META = {
  [PAYMENT_STATUS.PENDING]: { label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  [PAYMENT_STATUS.SUCCEEDED]: { label: 'Succeeded', cls: 'bg-emerald-100 text-emerald-700' },
  [PAYMENT_STATUS.VERIFIED]: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-700' },
  [PAYMENT_STATUS.FAILED]: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
};

const TRACKING_MONTH_STATUS_META = {
  PAID: { label: 'PAID', cls: 'bg-emerald-100 text-emerald-700' },
  PARTIAL: { label: 'PARTIAL', cls: 'bg-amber-100 text-amber-700' },
  UNPAID: { label: 'UNPAID', cls: 'bg-slate-100 text-slate-700' },
  OVERDUE: { label: 'OVERDUE', cls: 'bg-red-100 text-red-700' },
};

const PAID_SCHEDULE_STATUSES = new Set(['paid', 'succeeded', 'verified', 'completed', 'success']);

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundToMoney = (value) => {
  return Math.round(toSafeNumber(value) * 100) / 100;
};

const formatMoney = (value) => {
  return roundToMoney(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const firstDefinedNumber = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizePaymentStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === PAYMENT_STATUS.VERIFIED) return PAYMENT_STATUS.VERIFIED;
  if (['paid', 'succeeded', 'success', 'completed'].includes(normalized)) return PAYMENT_STATUS.SUCCEEDED;
  if (['failed', 'rejected', 'declined'].includes(normalized)) return PAYMENT_STATUS.FAILED;
  return PAYMENT_STATUS.PENDING;
};

const getPaymentStatusMeta = (status) => {
  const normalized = normalizePaymentStatus(status);
  return PAYMENT_STATUS_META[normalized] || PAYMENT_STATUS_META[PAYMENT_STATUS.PENDING];
};

const normalizeTrackingMonthStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'PAID') return 'PAID';
  if (normalized === 'PARTIAL') return 'PARTIAL';
  if (normalized === 'OVERDUE') return 'OVERDUE';
  return 'UNPAID';
};

const getTrackingMonthStatusMeta = (status) => {
  const normalized = normalizeTrackingMonthStatus(status);
  return TRACKING_MONTH_STATUS_META[normalized] || TRACKING_MONTH_STATUS_META.UNPAID;
};

const getTrackingMonthLabel = (periodStart, periodEnd) => {
  return `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;
};

const getScheduleAmount = (item) => {
  return firstDefinedNumber(item?.amountDue, item?.amount, item?.totalAmount, item?.invoiceAmount);
};

const getSchedulePaidAmount = (item) => {
  return firstDefinedNumber(item?.amountPaid, item?.paidAmount);
};

const getScheduleBalanceDue = (item) => {
  const explicitBalance = Number(item?.balanceDue);
  if (Number.isFinite(explicitBalance)) return explicitBalance;
  const amount = getScheduleAmount(item);
  const paid = getSchedulePaidAmount(item);
  return Math.max(amount - paid, 0);
};

const isScheduleRowPaid = (item) => {
  const status = String(item?.status || '').trim().toLowerCase();
  return PAID_SCHEDULE_STATUSES.has(status);
};

const toIsoFromDateInput = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const buildStoragePaymentKey = (rentalId) => {
  if (!rentalId) return '';
  return `rental-payment-activity:${rentalId}`;
};

const cardElementOptions = {
  hidePostalCode: true,
  style: {
    base: {
      color: '#064A7E',
      fontSize: '14px',
      '::placeholder': { color: '#8A8E95' },
    },
  },
};

function StripeCardCheckoutForm({
  clientSecret,
  disabled,
  onConfirm,
  onError,
  onProcessingChange,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret || disabled) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setLocalError('Card element is not ready.');
      return;
    }

    setProcessing(true);
    onProcessingChange?.(true);
    setLocalError('');

    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (result.error) {
        const message = result.error.message || 'Stripe payment confirmation failed.';
        setLocalError(message);
        onError?.(message);
        return;
      }

      onConfirm?.(result.paymentIntent || null);
    } catch (err) {
      const message = err?.message || 'Unexpected Stripe error.';
      setLocalError(message);
      onError?.(message);
    } finally {
      setProcessing(false);
      onProcessingChange?.(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="border-2 border-app_lightGrey rounded-lg p-3 bg-white">
        <CardElement options={cardElementOptions} />
      </div>
      {localError && <p className="text-xs text-red-700 bg-red-50 p-2 rounded">{localError}</p>}
      <button
        type="submit"
        disabled={disabled || !stripe || processing}
        className="px-4 py-2 rounded-lg bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60"
      >
        {processing ? 'Processing...' : 'Confirm Card Payment'}
      </button>
    </form>
  );
}

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const getExpiryBadge = (rental) => {
  const moveOut = rental?.moveOutDate ? new Date(rental.moveOutDate) : null;
  const now = new Date();

  if (!moveOut || Number.isNaN(moveOut.getTime())) {
    return null; // No moveOutDate, don't show badge
  }

  const diffDays = Math.ceil((moveOut.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { label: 'Expired', cls: 'bg-red-100 text-red-700' };
  }

  if (diffDays <= 45) {
    return { label: `Expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, cls: 'bg-amber-100 text-amber-700' };
  }

  // More than 45 days remaining - don't show badge
  return null;
};

const getRentalId = (rental) => {
  if (!rental) return undefined;
  const id = rental?._id || rental?.id || rental?.rentalId;
  return id ? String(id).trim() : undefined;  // Never return empty string or null
};

const toInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const plusYears = (value, years = 7) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return undefined;
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString();
};

const fullName = (person) => {
  if (!person) return '';
  if (person.fullName) return String(person.fullName).trim();
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
};

const toLabel = (key) => {
  const normalized = String(key || '').replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const toScalarText = (value) => {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const objectToLines = (source) => {
  if (!source || typeof source !== 'object') return [];
  return Object.entries(source).map(([key, value]) => `${toLabel(key)}: ${toScalarText(value)}`);
};

const IcPin = ({ s = 20, color = '#064A7E' }) => <svg width={s} height={s} viewBox="0 0 24 24" fill={color}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" fill="white" /></svg>;

const CHAT_THREAD_ORDER = [
  RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER,
  RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT,
];

const CHAT_THREAD_META = {
  [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER]: {
    label: 'Owner',
    inputPlaceholder: 'Send message to owner',
  },
  [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT]: {
    label: 'Tenant',
    inputPlaceholder: 'Send message to tenant',
  },
};

const createEmptyConversationMap = () => ({
  [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER]: '',
  [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT]: '',
});

const createEmptyMessagesMap = () => ({
  [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER]: [],
  [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT]: [],
});

const createEmptySendingMap = () => ({
  [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER]: false,
  [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT]: false,
});

const normalizeChatThread = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER) {
    return RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER;
  }
  if (normalized === RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT) {
    return RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT;
  }
  return '';
};

const resolveEntityId = (value, depth = 0) => {
  if (depth > 4 || value === null || value === undefined) return '';

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  if (typeof value !== 'object') {
    return '';
  }

  const candidates = [
    value?._id,
    value?.id,
    value?.userId,
    value?.user_id,
    value?.sub,
    value?.$id,
    value?.$oid,
    value?.user,
  ];

  for (const candidate of candidates) {
    const extracted = resolveEntityId(candidate, depth + 1);
    if (extracted) return extracted;
  }

  return '';
};

export default function RentedPropertyDetailPage() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [tab, setTab] = useState(sectionTabs[0].name);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [property, setProperty] = useState(null);
  const [rental, setRental] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [owner, setOwner] = useState(null);
  const [agent, setAgent] = useState(null);
  const [paymentSchedule, setPaymentSchedule] = useState([]);
  const [listing, setListing] = useState(null);
  const [branchName, setBranchName] = useState(null);
  const [showFullAddress, setShowFullAddress] = useState(false);

  const [stripeIntentState, setStripeIntentState] = useState({
    clientSecret: '',
    paymentId: '',
    mode: '',
  });
  const [stripeDraft, setStripeDraft] = useState({
    amount: '',
    currency: 'tnd',
    billingPeriodStart: '',
    billingPeriodEnd: '',
  });
  const [bulkDraft, setBulkDraft] = useState({
    monthsCount: '2',
    startFromMonth: '',
  });
  const [trancheDraft, setTrancheDraft] = useState({
    trancheAmount: '',
    trancheNumber: '1',
    forMonth: '',
  });
  const [offlineDraft, setOfflineDraft] = useState({
    amount: '',
    currency: 'tnd',
    paymentMethod: PAYMENT_METHODS.CASH,
    paymentMethodNote: '',
    paymentProofUrl: '',
    chequeNumber: '',
    chequeDate: '',
    bankName: '',
    billingPeriodStart: '',
    billingPeriodEnd: '',
  });
  const [offlineProofFile, setOfflineProofFile] = useState(null);
  const [offlineProofMeta, setOfflineProofMeta] = useState({
    url: '',
    publicId: '',
    fileName: '',
  });
  const [saveProofAsReceiptDoc, setSaveProofAsReceiptDoc] = useState(false);
  const [paymentActionBusy, setPaymentActionBusy] = useState({
    stripeSingle: false,
    stripeBulk: false,
    stripeTranche: false,
    stripeConfirm: false,
    offline: false,
    uploadProof: false,
    refresh: false,
  });
  const [paymentActionError, setPaymentActionError] = useState('');
  const [paymentActionNotice, setPaymentActionNotice] = useState('');
  const [paymentActivity, setPaymentActivity] = useState([]);
  const [paymentTracking, setPaymentTracking] = useState({ timeline: [] });
  const [trackingMonthDetail, setTrackingMonthDetail] = useState(null);

  const [conversationIds, setConversationIds] = useState(createEmptyConversationMap);
  const [messagesByConversation, setMessagesByConversation] = useState(createEmptyMessagesMap);
  const [activeConversationType, setActiveConversationType] = useState(RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT);
  const [chatDrafts, setChatDrafts] = useState(createEmptyConversationMap);
  const [chatError, setChatError] = useState('');
  const [chatSending, setChatSending] = useState(createEmptySendingMap);
  const [socketConnected, setSocketConnected] = useState(false);

  const [contracts, setContracts] = useState([]);
  const [latestContract, setLatestContract] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsBusy, setDocsBusy] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [showManualContractModal, setShowManualContractModal] = useState(false);
  const [showUploadDocumentModal, setShowUploadDocumentModal] = useState(false);
  const [manualContractBusy, setManualContractBusy] = useState(false);
  const [manualContractError, setManualContractError] = useState('');
  const [activeContractId, setActiveContractId] = useState('');
  const [attachedPdfFile, setAttachedPdfFile] = useState(null);
  const [manualUploadMeta, setManualUploadMeta] = useState({
    documentUrl: '',
    publicId: '',
    fileName: '',
  });
  const [signatureDrafts, setSignatureDrafts] = useState({
    tenant: { drawn: '', uploaded: '', fileName: '', uploadedFile: null },
    owner: { drawn: '', uploaded: '', fileName: '', uploadedFile: null },
    agent: { drawn: '', uploaded: '', fileName: '', uploadedFile: null },
  });
  const [manualDraft, setManualDraft] = useState({
    tenantName: '',
    tenantEmail: '',
    ownerName: '',
    ownerEmail: '',
    propertyReference: '',
    propertyAddress: '',
    moveInDate: '',
    moveOutDate: '',
    durationMonths: '',
    rentAmount: '',
    paymentAmount: '',
    paymentFrequency: '',
    autoRenew: 'No',
    depositAmount: '',
    agency: '',
    commonCharges: '',
    billsIncluded: '',
    billsDetails: '',
    lateFeeRules: '',
    maintenanceResponsibility: '',
    specialConditions: '',
    contractPoliciesSummary: '',
    housePoliciesSummary: '',
    customPoliciesSummary: '',
    additionalTerms: '',
  });
  const [documentForm, setDocumentForm] = useState({
    documentType: 'other',
    title: '',
    description: '',
    documentUrl: '',
    publicId: '',
    fileName: '',
    isPublic: true,
    expiresAt: '',
    notes: '',
  });
  const socketRef = useRef(null);
  const signaturePadsRef = useRef({ tenant: null, owner: null, agent: null });
  const recoveringConversationRef = useRef(false);

  const requestedChatThread = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizeChatThread(params.get('chatThread'));
  }, [location.search]);

  const requestedRentalId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveEntityId(params.get('rentalId'));
  }, [location.search]);

  const currentUserRole = String(user?.role || '').trim().toLowerCase();
  const currentUserId = useMemo(() => {
    const fromContext = resolveEntityId(user);
    if (fromContext) return fromContext;

    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      return resolveEntityId(stored);
    } catch {
      return '';
    }
  }, [user]);

  const isConversationNotFoundError = (err) => {
    const status = err?.response?.status;
    const msg = String(err?.response?.data?.message || err?.message || '').toLowerCase();
    return status === 404 || msg.includes('conversation not found') || msg.includes('not found');
  };

  const setThreadMessages = (threadType, chatMessages) => {
    setMessagesByConversation((prev) => ({
      ...prev,
      [threadType]: Array.isArray(chatMessages) ? chatMessages : [],
    }));
  };

  const recoverConversation = async (threadType) => {
    const rentalId = getRentalId(rental);
    const normalizedThreadType = normalizeChatThread(threadType);
    if (!rentalId || !normalizedThreadType || recoveringConversationRef.current) return;

    recoveringConversationRef.current = true;
    try {
      const start = await startRentalConversation(rentalId, normalizedThreadType);
      const nextConversationId = extractConversationId(start, normalizedThreadType);
      if (!nextConversationId) return;

      const chatMessages = await getRentalConversationMessages(nextConversationId);
      setConversationIds((prev) => ({
        ...prev,
        [normalizedThreadType]: String(nextConversationId),
      }));
      setThreadMessages(normalizedThreadType, chatMessages);
      setChatError('');
    } catch (err) {
      setChatError(err?.response?.data?.message || err?.message || 'Failed to recover chat conversation.');
    } finally {
      recoveringConversationRef.current = false;
    }
  };

  const triggerDownload = (url, fileName) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (fileName) link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const refreshDocumentsData = async (rentalId, typeFilter = documentTypeFilter) => {
    if (!rentalId) return;
    setDocsLoading(true);
    setDocsError('');
    try {
      const [contractsData, latestData, docsData] = await Promise.all([
        getRentalContracts(rentalId),
        getLatestRentalContract(rentalId).catch(() => null),
        getRentalDocuments(rentalId, typeFilter || undefined),
      ]);
      setContracts(Array.isArray(contractsData) ? contractsData : []);
      setLatestContract(latestData || null);
      setDocuments(Array.isArray(docsData) ? docsData : []);
    } catch (err) {
      setDocsError(err?.response?.data?.message || err?.message || 'Failed to load contracts/documents.');
      setContracts([]);
      setLatestContract(null);
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const rentalRecordId = getRentalId(rental);
  const paymentActivityStorageKey = useMemo(
    () => buildStoragePaymentKey(rentalRecordId),
    [rentalRecordId],
  );

  useEffect(() => {
    if (!paymentActivityStorageKey) {
      setPaymentActivity([]);
      return;
    }

    try {
      const raw = localStorage.getItem(paymentActivityStorageKey);
      if (!raw) {
        setPaymentActivity([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setPaymentActivity(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPaymentActivity([]);
    }
  }, [paymentActivityStorageKey]);

  useEffect(() => {
    if (!paymentActivityStorageKey) return;
    try {
      localStorage.setItem(paymentActivityStorageKey, JSON.stringify(paymentActivity.slice(0, 50)));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [paymentActivityStorageKey, paymentActivity]);

  const appendPaymentActivityEntry = (entry) => {
    const nowIso = new Date().toISOString();
    const nextEntry = {
      localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: entry?.createdAt || nowIso,
      status: normalizePaymentStatus(entry?.status),
      source: entry?.source || 'manual',
      paymentMethod: entry?.paymentMethod || '',
      paymentId: entry?.paymentId || '',
      amount: toSafeNumber(entry?.amount),
      currency: String(entry?.currency || offlineDraft.currency || stripeDraft.currency || 'tnd').toUpperCase(),
      note: String(entry?.note || '').trim(),
      paymentProofUrl: entry?.paymentProofUrl || '',
      rejectionNote: String(entry?.rejectionNote || '').trim(),
      billingPeriodStart: entry?.billingPeriodStart || '',
      billingPeriodEnd: entry?.billingPeriodEnd || '',
    };

    setPaymentActivity((prev) => [nextEntry, ...prev].slice(0, 50));
  };

  const refreshRentalFinanceData = async (targetRentalId, { silent = false } = {}) => {
    if (!targetRentalId) return;

    setPaymentActionBusy((prev) => ({ ...prev, refresh: true }));
    try {
      const [rentalData, scheduleData, trackingData] = await Promise.all([
        getRentalById(targetRentalId).catch(() => null),
        getRentalPaymentSchedule(targetRentalId).catch(() => []),
        getRentalPaymentTracking(targetRentalId, 12).catch(() => null),
      ]);

      if (rentalData && typeof rentalData === 'object') {
        setRental((prev) => ({ ...(prev || {}), ...rentalData }));
      }
      setPaymentSchedule(Array.isArray(scheduleData) ? scheduleData : []);
      setPaymentTracking(trackingData && typeof trackingData === 'object' ? trackingData : { timeline: [] });
    } catch (err) {
      if (!silent) {
        setPaymentActionError(err?.response?.data?.message || err?.message || 'Failed to refresh payment data.');
      }
    } finally {
      setPaymentActionBusy((prev) => ({ ...prev, refresh: false }));
    }
  };

  const uploadOfflineProof = async (fileOverride = null) => {
    const file = fileOverride || offlineProofFile;
    if (!file) return null;

    setPaymentActionBusy((prev) => ({ ...prev, uploadProof: true }));
    setPaymentActionError('');

    try {
      const uploaded = await uploadContractPdfToCloudinary(file);
      const nextMeta = {
        url: String(uploaded?.url || ''),
        publicId: String(uploaded?.publicId || ''),
        fileName: String(uploaded?.fileName || file?.name || 'payment-proof'),
      };
      setOfflineProofMeta(nextMeta);
      setOfflineDraft((prev) => ({ ...prev, paymentProofUrl: nextMeta.url }));
      setPaymentActionNotice('Payment proof uploaded successfully.');
      return nextMeta;
    } catch (err) {
      setPaymentActionError(err?.message || 'Failed to upload payment proof.');
      return null;
    } finally {
      setPaymentActionBusy((prev) => ({ ...prev, uploadProof: false }));
    }
  };

  const resetStripeIntentState = () => {
    setStripeIntentState({ clientSecret: '', paymentId: '', mode: '' });
  };

  const createStripeSingleIntent = async () => {
    const targetRentalId = getRentalId(rental);
    if (!targetRentalId) {
      setPaymentActionError('Missing rental ID for payment intent.');
      return;
    }

    if (!String(stripeDraft.amount || '').trim()) {
      setPaymentActionError('Amount is required.');
      return;
    }

    const amountNumber = Number(stripeDraft.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setPaymentActionError('Amount must be greater than 0.');
      return;
    }

    setPaymentActionBusy((prev) => ({ ...prev, stripeSingle: true }));
    setPaymentActionError('');
    setPaymentActionNotice('');

    try {
      const response = await createPaymentIntent(targetRentalId, {
        amount: amountNumber,
        currency: stripeDraft.currency || undefined,
        billingPeriodStart: toIsoFromDateInput(stripeDraft.billingPeriodStart),
        billingPeriodEnd: toIsoFromDateInput(stripeDraft.billingPeriodEnd),
      });

      const clientSecret = String(response?.clientSecret || '');
      if (!clientSecret) {
        throw new Error('Stripe payment intent returned without clientSecret.');
      }

      setStripeIntentState({
        clientSecret,
        paymentId: String(response?.paymentId || ''),
        mode: 'single',
      });
      setPaymentActionNotice('Stripe payment intent is ready. Complete card confirmation below.');
      await refreshRentalFinanceData(targetRentalId, { silent: true });
    } catch (err) {
      setPaymentActionError(err?.response?.data?.message || err?.message || 'Failed to create Stripe payment intent.');
    } finally {
      setPaymentActionBusy((prev) => ({ ...prev, stripeSingle: false }));
    }
  };

  const createStripeBulkIntent = async () => {
    const targetRentalId = getRentalId(rental);
    if (!targetRentalId) {
      setPaymentActionError('Missing rental ID for bulk payment.');
      return;
    }

    const monthsCount = Number(bulkDraft.monthsCount);
    if (!Number.isInteger(monthsCount) || monthsCount < 2) {
      setPaymentActionError('Bulk payment requires at least 2 months.');
      return;
    }

    setPaymentActionBusy((prev) => ({ ...prev, stripeBulk: true }));
    setPaymentActionError('');
    setPaymentActionNotice('');

    try {
      const response = await createBulkPayment(
        targetRentalId,
        monthsCount,
        bulkDraft.startFromMonth ? new Date(bulkDraft.startFromMonth) : undefined,
      );

      const clientSecret = String(response?.clientSecret || '');
      if (!clientSecret) {
        throw new Error('Stripe bulk payment intent returned without clientSecret.');
      }

      setStripeIntentState({
        clientSecret,
        paymentId: String(response?.paymentId || ''),
        mode: 'bulk',
      });
      setPaymentActionNotice(`Stripe bulk intent ready for ${response?.coveredMonths || monthsCount} month(s).`);
      await refreshRentalFinanceData(targetRentalId, { silent: true });
    } catch (err) {
      setPaymentActionError(err?.response?.data?.message || err?.message || 'Failed to create Stripe bulk intent.');
    } finally {
      setPaymentActionBusy((prev) => ({ ...prev, stripeBulk: false }));
    }
  };

  const createStripeTrancheIntent = async () => {
    const targetRentalId = getRentalId(rental);
    if (!targetRentalId) {
      setPaymentActionError('Missing rental ID for tranche payment.');
      return;
    }

    const trancheAmount = Number(trancheDraft.trancheAmount);
    const trancheNumber = Number(trancheDraft.trancheNumber);

    if (!Number.isFinite(trancheAmount) || trancheAmount <= 0) {
      setPaymentActionError('Tranche amount must be greater than 0.');
      return;
    }

    if (!Number.isInteger(trancheNumber) || trancheNumber < 1) {
      setPaymentActionError('Tranche number must be at least 1.');
      return;
    }

    setPaymentActionBusy((prev) => ({ ...prev, stripeTranche: true }));
    setPaymentActionError('');
    setPaymentActionNotice('');

    try {
      const response = await createTranchedPayment(
        targetRentalId,
        trancheAmount,
        trancheNumber,
        trancheDraft.forMonth ? new Date(trancheDraft.forMonth) : undefined,
      );

      const clientSecret = String(response?.clientSecret || '');
      if (!clientSecret) {
        throw new Error('Stripe tranche payment intent returned without clientSecret.');
      }

      setStripeIntentState({
        clientSecret,
        paymentId: String(response?.paymentId || ''),
        mode: 'tranche',
      });
      setPaymentActionNotice('Stripe tranche intent is ready. Complete card confirmation below.');
      await refreshRentalFinanceData(targetRentalId, { silent: true });
    } catch (err) {
      setPaymentActionError(err?.response?.data?.message || err?.message || 'Failed to create Stripe tranche intent.');
    } finally {
      setPaymentActionBusy((prev) => ({ ...prev, stripeTranche: false }));
    }
  };

  const handleStripePaymentConfirmed = async (paymentIntent) => {
    const targetRentalId = getRentalId(rental);
    if (!targetRentalId) return;

    appendPaymentActivityEntry({
      source: 'stripe',
      status: PAYMENT_STATUS.PENDING,
      paymentMethod: PAYMENT_METHODS.STRIPE,
      paymentId: stripeIntentState.paymentId || paymentIntent?.id || '',
      amount: stripeDraft.amount,
      currency: stripeDraft.currency || 'tnd',
      note: 'Card confirmation received. Awaiting backend webhook finalization.',
      billingPeriodStart: toIsoFromDateInput(stripeDraft.billingPeriodStart),
      billingPeriodEnd: toIsoFromDateInput(stripeDraft.billingPeriodEnd),
    });

    setPaymentActionNotice('Stripe card confirmed. Payment status is being finalized by webhook. Refreshing shortly...');
    resetStripeIntentState();

    window.setTimeout(() => {
      refreshRentalFinanceData(targetRentalId, { silent: true });
    }, 1500);
  };

  const submitOfflinePaymentRequest = async () => {
    const targetRentalId = getRentalId(rental);
    if (!targetRentalId) {
      setPaymentActionError('Missing rental ID for offline payment.');
      return;
    }

    const amountNumber = Number(offlineDraft.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setPaymentActionError('Amount must be greater than 0.');
      return;
    }

    if (offlineDraft.paymentMethod === PAYMENT_METHODS.CHEQUE && !String(offlineDraft.chequeNumber || '').trim()) {
      setPaymentActionError('Cheque number is required for cheque payments.');
      return;
    }

    setPaymentActionBusy((prev) => ({ ...prev, offline: true }));
    setPaymentActionError('');
    setPaymentActionNotice('');

    try {
      let proofUrl = String(offlineDraft.paymentProofUrl || '').trim();
      let proofMeta = offlineProofMeta;

      if (!proofUrl && offlineProofFile) {
        const uploaded = await uploadOfflineProof(offlineProofFile);
        if (uploaded?.url) {
          proofUrl = uploaded.url;
          proofMeta = uploaded;
        }
      }

      const payload = {
        amount: amountNumber,
        currency: offlineDraft.currency || undefined,
        paymentMethod: offlineDraft.paymentMethod,
        paymentMethodNote: offlineDraft.paymentMethodNote || undefined,
        paymentProofUrl: proofUrl || undefined,
        chequeNumber: offlineDraft.paymentMethod === PAYMENT_METHODS.CHEQUE
          ? String(offlineDraft.chequeNumber || '').trim()
          : undefined,
        chequeDate: offlineDraft.chequeDate ? toIsoFromDateInput(offlineDraft.chequeDate) : undefined,
        bankName: offlineDraft.bankName || undefined,
        billingPeriodStart: toIsoFromDateInput(offlineDraft.billingPeriodStart),
        billingPeriodEnd: toIsoFromDateInput(offlineDraft.billingPeriodEnd),
      };

      const response = await createOfflinePayment(targetRentalId, payload);
      const createdPayment = response?.payment || response;

      appendPaymentActivityEntry({
        source: 'offline',
        status: createdPayment?.status || PAYMENT_STATUS.PENDING,
        paymentMethod: payload.paymentMethod,
        paymentId: createdPayment?._id || createdPayment?.id || '',
        amount: createdPayment?.amount ?? payload.amount,
        currency: createdPayment?.currency || payload.currency || 'tnd',
        note: payload.paymentMethodNote || 'Awaiting accountant verification.',
        paymentProofUrl: createdPayment?.paymentProofUrl || proofUrl,
        billingPeriodStart: createdPayment?.billingPeriodStart || payload.billingPeriodStart,
        billingPeriodEnd: createdPayment?.billingPeriodEnd || payload.billingPeriodEnd,
      });

      if (saveProofAsReceiptDoc && proofUrl) {
        try {
          await createRentalDocument({
            rentalId: targetRentalId,
            documentType: 'receipt',
            title: `Offline ${payload.paymentMethod} payment proof`,
            description: 'Payment proof submitted from active rental detail.',
            documentUrl: proofUrl,
            publicId: proofMeta?.publicId || undefined,
            fileName: proofMeta?.fileName || undefined,
            isPublic: false,
            notes: payload.paymentMethodNote || undefined,
          });
          await refreshDocumentsData(targetRentalId, documentTypeFilter);
        } catch {
          // Do not block payment flow if receipt document creation fails.
        }
      }

      setPaymentActionNotice('Offline payment submitted. Status is pending accountant verification.');
      await refreshRentalFinanceData(targetRentalId, { silent: true });
    } catch (err) {
      setPaymentActionError(err?.response?.data?.message || err?.message || 'Failed to submit offline payment.');
    } finally {
      setPaymentActionBusy((prev) => ({ ...prev, offline: false }));
    }
  };

  const tenantSignerId = resolveEntityId(rental?.tenantId);
  const ownerSignerId = resolveEntityId(rental?.ownerId);
  const agentSignerId = resolveEntityId(rental?.agentId);

  const resolvedContractId = activeContractId || latestContract?._id || '';
  const fees = property?.fees || listing?.fees || listing?.policies?.fees || {};
  const contractPolicies = property?.contractPolicies || listing?.contractPolicies || listing?.policies?.contractPolicies || {};
  const housePolicies = property?.housePolicies || listing?.housePolicies || listing?.policies?.housePolicies || {};
  const customPolicies = property?.customPolicies
    || listing?.customPolicies
    || property?.customFields
    || listing?.customFields
    || listing?.policies?.customFields
    || {};
  const propertyReference = String(listing?.referenceNumber || property?.referenceNumber || property?._id || '').trim();

  const tenantSigned = Boolean(
    latestContract?.signatures?.tenant?.signed
    || latestContract?.tenantSignedAt
    || latestContract?.tenantSignatureImageUrl
  );
  const ownerSigned = Boolean(
    latestContract?.signatures?.owner?.signed
    || latestContract?.ownerSignedAt
    || latestContract?.ownerSignatureImageUrl
  );
  const agentSigned = Boolean(
    latestContract?.signatures?.agent?.signed
    || latestContract?.agentSignedAt
    || latestContract?.agentSignatureImageUrl
    || (Array.isArray(latestContract?.signedBy) && latestContract.signedBy.includes(agentSignerId))
  );
  const allContractSignaturesComplete = tenantSigned && ownerSigned && agentSigned;
  const manualFieldLabels = {
    tenantName: 'Tenant name',
    ownerName: 'Owner name',
    propertyAddress: 'Property address',
    moveInDate: 'Move-in date',
    moveOutDate: 'Move-out date',
    durationMonths: 'Duration (months)',
    paymentAmount: 'Payment amount',
    paymentFrequency: 'Payment frequency',
  };
  const requiredManualDraftKeys = [
    'tenantName',
    'ownerName',
    'propertyAddress',
    'moveInDate',
    'moveOutDate',
    'durationMonths',
    'paymentAmount',
    'paymentFrequency',
  ];
  const isFilled = (value) => String(value ?? '').trim().length > 0;
  const hasRoleSignatureInput = (role) => {
    const roleDraft = signatureDrafts?.[role] || { drawn: '', uploaded: '', uploadedFile: null };
    const rolePad = signaturePadsRef.current?.[role];
    const hasDrawnOnPad = Boolean(rolePad && !rolePad.isEmpty());
    return Boolean(roleDraft.drawn || roleDraft.uploaded || roleDraft.uploadedFile || hasDrawnOnPad);
  };
  const missingRequiredManualFields = requiredManualDraftKeys.filter((key) => !isFilled(manualDraft?.[key]));
  const areAllManualFieldsFilled = missingRequiredManualFields.length === 0;
  const allThreeSignaturesReady = ['tenant', 'owner', 'agent'].every((role) => hasRoleSignatureInput(role));
  const hasContractPdfReady = Boolean(manualUploadMeta.documentUrl || attachedPdfFile);
  const canConfirmContract = Boolean(
    areAllManualFieldsFilled
    && hasContractPdfReady
    && allThreeSignaturesReady
    && !manualContractBusy
    && !allContractSignaturesComplete
  );

  const openManualContractWorkflow = () => {
    if (!canManageRentalContracts) {
      setDocsError('Only staff can create or renew rental contracts.');
      return;
    }

    const contractLines = objectToLines(contractPolicies);
    const houseLines = objectToLines(housePolicies);
    const customLines = objectToLines(customPolicies);
    const billsDetailsValue = Array.isArray(fees?.billsDetails)
      ? fees.billsDetails.join(', ')
      : String(fees?.billsDetails || '');

    setManualContractError('');
    setAttachedPdfFile(null);
    setManualUploadMeta({ documentUrl: '', publicId: '', fileName: '' });
    setSignatureDrafts({
      tenant: { drawn: '', uploaded: '', fileName: '', uploadedFile: null },
      owner: { drawn: '', uploaded: '', fileName: '', uploadedFile: null },
      agent: { drawn: '', uploaded: '', fileName: '', uploadedFile: null },
    });
    Object.values(signaturePadsRef.current || {}).forEach((pad) => pad?.clear?.());
    setActiveContractId('');
    setManualDraft({
      tenantName: fullName(tenant) || fullName(rental?.tenantId) || '',
      tenantEmail: tenant?.email || rental?.tenantId?.email || '',
      ownerName: fullName(owner) || fullName(rental?.ownerId) || '',
      ownerEmail: owner?.email || rental?.ownerId?.email || '',
      propertyReference,
      propertyAddress: property?.address || '',
      moveInDate: toInputDate(rental?.moveInDate),
      moveOutDate: toInputDate(rental?.moveOutDate),
      durationMonths: String(rental?.durationMonths || ''),
      rentAmount: String(fees?.rentAmount ?? property?.price ?? rental?.amount ?? ''),
      paymentAmount: String(fees?.rentAmount ?? property?.price ?? rental?.amount ?? ''),
      paymentFrequency: String(rental?.paymentFrequencyMonths || 1),
      autoRenew: rental?.autoRenew ? 'Yes' : 'No',
      depositAmount: String(rental?.depositAmount || fees?.depositAmount || ''),
      agencyFees: String(fees?.agencyFees ?? ''),
      commonCharges: String(fees?.commonCharges ?? ''),
      billsIncluded: toScalarText(fees?.billsIncluded),
      billsDetails: billsDetailsValue,
      lateFeeRules: contractPolicies?.noticePeriodDays ? `${contractPolicies.noticePeriodDays} days notice period` : '',
      maintenanceResponsibility: housePolicies?.cleaningSchedule || '',
      specialConditions: [
        typeof contractPolicies?.petsAllowed === 'boolean' ? `Pets allowed: ${contractPolicies.petsAllowed ? 'Yes' : 'No'}` : '',
        typeof contractPolicies?.sublettingAllowed === 'boolean' ? `Subletting allowed: ${contractPolicies.sublettingAllowed ? 'Yes' : 'No'}` : '',
        typeof contractPolicies?.guarantorRequired === 'boolean' ? `Guarantor required: ${contractPolicies.guarantorRequired ? 'Yes' : 'No'}` : '',
      ].filter(Boolean).join(' | '),
      contractPoliciesSummary: contractLines.join('\n'),
      housePoliciesSummary: houseLines.join('\n'),
      customPoliciesSummary: customLines.join('\n'),
      additionalTerms: rental?.notes || '',
    });
    setShowManualContractModal(true);
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read signature file.'));
    reader.readAsDataURL(file);
  });

  const handleRoleSignatureFile = async (role, file) => {
    if (!file) {
      setSignatureDrafts((prev) => ({
        ...prev,
        [role]: { ...prev[role], uploaded: '', fileName: '', uploadedFile: null },
      }));
      return;
    }
    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      setManualContractError('Signature upload must be an image file (PNG/JPG/WebP).');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSignatureDrafts((prev) => ({
        ...prev,
        [role]: { ...prev[role], uploaded: dataUrl, fileName: file.name, uploadedFile: file },
      }));
      setManualContractError('');
    } catch (err) {
      setManualContractError(err?.message || 'Failed to process signature image.');
    }
  };

  const dataUrlToFile = (dataUrl, fileName) => {
    const [meta, base64] = String(dataUrl || '').split(',');
    const mimeMatch = /data:(.*?);base64/.exec(meta || '');
    const mime = mimeMatch?.[1] || 'image/png';
    const binary = atob(base64 || '');
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mime });
  };

  const captureRoleDrawnSignature = (role) => {
    const pad = signaturePadsRef.current?.[role];
    if (!pad || pad.isEmpty()) {
      setSignatureDrafts((prev) => ({
        ...prev,
        [role]: { ...prev[role], drawn: '' },
      }));
      return '';
    }
    const drawn = pad.getCanvas().toDataURL('image/png');
    setSignatureDrafts((prev) => ({
      ...prev,
      [role]: { ...prev[role], drawn },
    }));
    return drawn;
  };

  const clearRoleDrawnSignature = (role) => {
    signaturePadsRef.current?.[role]?.clear?.();
    setSignatureDrafts((prev) => ({
      ...prev,
      [role]: { ...prev[role], drawn: '' },
    }));
  };

  const exportManualContractPdf = async () => {
    const rentalId = getRentalId(rental) || 'unknown';
    const version = Number(latestContract?.versionNumber || 0) + 1;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 60;
    const step = 16;
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // Color scheme
    const colors = {
      primary: [6, 74, 126], // #064A7E
      secondary: [225, 213, 101], // #E1D565
      dark: [41, 43, 46], // #292B2E
      lightGrey: [230, 235, 242], // #E6EBF2
      text: [51, 51, 51], // #333333
    };

    // Small icon: draw a filled circle
    const drawIcon = (x, yPos, color = colors.primary, size = 8) => {
      pdf.setFillColor(...color);
      pdf.circle(x + size / 2, yPos - size / 2, size / 2, 'F');
    };

    // Helper: Add header to page
    const addPageHeader = () => {
      pdf.setFillColor(...colors.primary);
      pdf.rect(0, 0, pageWidth, 60, 'F');
      pdf.setFontSize(22);
      pdf.setTextColor(255, 255, 255);
      pdf.text('RENTAL CONTRACT', margin, 38);
      pdf.setFontSize(10);
      pdf.text(`Ref: ${rentalId} | v${version}`, pageWidth - margin - 110, 38);
      y = 90;
    };

    // Helper: Add footer to page
    const addPageFooter = (pageNumber) => {
      pdf.setDrawColor(...colors.lightGrey);
      pdf.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
      pdf.setFontSize(9);
      pdf.setTextColor(...colors.dark);
      pdf.text(`SmartProperty | Confidential`, margin, pageHeight - 15);
      pdf.text(`Page ${pageNumber}`, pageWidth - margin - 30, pageHeight - 15);
    };

    // Helper: Add section header with colored background and icon
    const sectionHeader = (title) => {
      addPageIfNeeded(60);
      pdf.setFillColor(...colors.secondary);
      pdf.roundedRect(margin, y - 12, contentWidth, 26, 4, 4, 'F');
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(...colors.dark);
      drawIcon(margin + 8, y + 2, colors.primary, 10);
      pdf.text(title, margin + 22, y + 6);
      pdf.setFont(undefined, 'normal');
      y += 36;
    };

    // Helper: Draw info row (label: value) with extra padding
    const infoRow = (label, value, isBold = false) => {
      addPageIfNeeded(30);
      pdf.setFontSize(11);
      if (isBold) pdf.setFont(undefined, 'bold');
      pdf.setTextColor(...colors.dark);
      pdf.text(label, margin, y);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(...colors.text);
      const valueText = String(value || '-');
      const lines = pdf.splitTextToSize(valueText, contentWidth - 160);
      lines.forEach((line, idx) => {
        if (idx > 0) y += step - 6;
        pdf.text(line, margin + 160, y);
      });
      y += step + 4;
    };

    // Helper: Draw section divider
    const divider = () => {
      pdf.setDrawColor(...colors.lightGrey);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 12;
    };

    const addPageIfNeeded = (minSpaceNeeded = 120) => {
      if (y + minSpaceNeeded > pageHeight - 60) {
        addPageFooter(pdf.internal.getNumberOfPages());
        pdf.addPage();
        addPageHeader();
      }
    };

    addPageHeader();

    // === PARTY INFORMATION ===
    sectionHeader('PARTIES INVOLVED');
    infoRow('Tenant Name:', manualDraft.tenantName, true);
    infoRow('Tenant Email:', manualDraft.tenantEmail);
    divider();
    infoRow('Owner Name:', manualDraft.ownerName, true);
    infoRow('Owner Email:', manualDraft.ownerEmail);
    divider();
    infoRow('Property Reference:', manualDraft.propertyReference || propertyReference || '-', true);
    infoRow('Property Address:', manualDraft.propertyAddress);

    // === LEASE DETAILS ===
    y += 6;
    sectionHeader('LEASE DETAILS');
    infoRow('Move-in Date:', manualDraft.moveInDate);
    infoRow('Move-out Date:', manualDraft.moveOutDate);
    infoRow('Duration:', `${manualDraft.durationMonths} month(s)`);
    infoRow('Payment Frequency:', `Every ${manualDraft.paymentFrequency} month(s)`);
    infoRow('Auto Renewal:', manualDraft.autoRenew);

    // === FINANCIAL TERMS ===
    y += 6;
    sectionHeader('FINANCIAL TERMS');
    infoRow('Monthly Rent:', `${manualDraft.rentAmount || manualDraft.paymentAmount || '-'} TND`, true);
    infoRow('Payment Amount:', `${manualDraft.paymentAmount || '-'} TND`, true);
    divider();
    infoRow('Deposit Amount:', manualDraft.depositAmount || '-');
    infoRow('Agency Fees:', manualDraft.agencyFees || '-');
    infoRow('Common Charges:', manualDraft.commonCharges || '-');
    infoRow('Bills Included:', toScalarText(manualDraft.billsIncluded) || '-');

    if (manualDraft.billsDetails) {
      pdf.setFontSize(10);
      pdf.setTextColor(...colors.text);
      const billLines = String(manualDraft.billsDetails || '').split(', ');
      billLines.forEach((bill) => {
        if (bill.trim()) {
          addPageIfNeeded(18);
          drawIcon(margin + 6, y + 4, colors.primary, 6);
          pdf.text(` ${bill.trim()}`, margin + 16, y + 4);
          y += 14;
        }
      });
    }

    // === CONTRACT POLICIES ===
    if (manualDraft.contractPoliciesSummary) {
      y += 6;
      sectionHeader('CONTRACT POLICIES');
      const contractPolicyLines = String(manualDraft.contractPoliciesSummary || '').split('\n').filter(Boolean);
      contractPolicyLines.forEach((line) => {
        addPageIfNeeded(18);
        pdf.setFontSize(10);
        pdf.setTextColor(...colors.text);
        drawIcon(margin + 6, y + 4, colors.primary, 6);
        pdf.text(` ${line.trim()}`, margin + 16, y + 4);
        y += 14;
      });
    }

    // === HOUSE POLICIES ===
    if (manualDraft.housePoliciesSummary) {
      y += 6;
      sectionHeader('HOUSE POLICIES');
      const housePolicyLines = String(manualDraft.housePoliciesSummary || '').split('\n').filter(Boolean);
      housePolicyLines.forEach((line) => {
        addPageIfNeeded(18);
        pdf.setFontSize(10);
        pdf.setTextColor(...colors.text);
        drawIcon(margin + 6, y + 4, colors.primary, 6);
        pdf.text(` ${line.trim()}`, margin + 16, y + 4);
        y += 14;
      });
    }

    // === CUSTOM POLICIES ===
    if (manualDraft.customPoliciesSummary) {
      y += 6;
      sectionHeader('SPECIAL CONDITIONS');
      const customPolicyLines = String(manualDraft.customPoliciesSummary || '').split('\n').filter(Boolean);
      customPolicyLines.forEach((line) => {
        addPageIfNeeded(18);
        pdf.setFontSize(10);
        pdf.setTextColor(...colors.text);
        drawIcon(margin + 6, y + 4, colors.primary, 6);
        pdf.text(` ${line.trim()}`, margin + 16, y + 4);
        y += 14;
      });
    }

    // === CONTRACT TERMS ===
    y += 6;
    sectionHeader('CONTRACT TERMS');
    if (manualDraft.lateFeeRules) infoRow('Late Fee Rules:', manualDraft.lateFeeRules);
    if (manualDraft.maintenanceResponsibility) infoRow('Maintenance:', manualDraft.maintenanceResponsibility);
    if (manualDraft.specialConditions) infoRow('Special Conditions:', manualDraft.specialConditions);
    if (manualDraft.additionalTerms) infoRow('Additional Notes:', manualDraft.additionalTerms);

    // === SIGNATURE PAGE ===
    addPageIfNeeded(260);
    addPageFooter(pdf.internal.getNumberOfPages());
    pdf.addPage();
    addPageHeader();

    y += 10;
    sectionHeader('AUTHORIZED SIGNATURES');

    const signatureWidth = 130;
    const signatureHeight = 80;
    const sigStartY = y;
    const sigSpacing = (contentWidth - signatureWidth * 3) / 2;

    // Helper to add signature image to PDF
    const addSignatureImage = async (role, xPos, yPos) => {
      const roleDraft = signatureDrafts?.[role] || {};
      const signatureSource = roleDraft.uploaded || roleDraft.drawn;

      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

      // Draw signature box
      pdf.setDrawColor(...colors.primary);
      pdf.rect(xPos, yPos, signatureWidth, signatureHeight, 'S');

      if (signatureSource) {
        try {
          pdf.addImage(signatureSource, 'PNG', xPos + 4, yPos + 4, signatureWidth - 8, signatureHeight - 8);
        } catch (err) {
          console.error(`Error adding ${role} signature to PDF:`, err);
          pdf.setFontSize(9);
          pdf.setTextColor(...colors.text);
          pdf.text('[Unable to embed signature]', xPos + 8, yPos + signatureHeight / 2);
        }
      } else {
        pdf.setFontSize(9);
        pdf.setTextColor(180, 180, 180);
        pdf.text('[Not signed]', xPos + 8, yPos + signatureHeight / 2);
      }

      // Label below signature
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(...colors.dark);
      pdf.text(roleLabel, xPos, yPos + signatureHeight + 16);

      // Date line
      pdf.setDrawColor(...colors.lightGrey);
      pdf.line(xPos, yPos + signatureHeight + 26, xPos + signatureWidth, yPos + signatureHeight + 26);
      pdf.setFontSize(9);
      pdf.setTextColor(...colors.text);
      pdf.text('Date: __________________', xPos, yPos + signatureHeight + 34);
    };

    // Add three signatures horizontally
    try {
      await addSignatureImage('tenant', margin, sigStartY);
      await addSignatureImage('owner', margin + signatureWidth + sigSpacing, sigStartY);
      await addSignatureImage('agent', margin + (signatureWidth + sigSpacing) * 2, sigStartY);
    } catch (err) {
      console.error('Error adding signatures to PDF:', err);
    }

    y = sigStartY + signatureHeight + 70;

    // === DOCUMENT METADATA ===
    addPageIfNeeded(100);
    y += 10;
    sectionHeader('DOCUMENT INFORMATION');
    infoRow('Rental ID:', rentalId);
    infoRow('Contract Version:', `v${version}`);
    infoRow('Tenant ID:', tenantSignerId || 'Missing');
    infoRow('Owner ID:', ownerSignerId || 'Missing');
    infoRow('Agent ID:', agentSignerId || 'Missing');
    infoRow('Generated:', new Date().toLocaleDateString());

    // Final footer
    addPageFooter(pdf.internal.getNumberOfPages());

    pdf.save(`rental_contract_${rentalId}_v${version}.pdf`);
  };

  const uploadManualContractPdf = async () => {
    if (!canManageRentalContracts) {
      setManualContractError('Only staff can upload contract revisions.');
      return;
    }

    console.log('[DEBUG] uploadManualContractPdf called. attachedPdfFile:', attachedPdfFile);
    if (!attachedPdfFile) {
      console.log('[DEBUG] No PDF file selected');
      setManualContractError('Please choose a PDF file before uploading.');
      return;
    }
    const isPdfMime = String(attachedPdfFile.type || '').toLowerCase() === 'application/pdf';
    const isPdfName = /\.pdf$/i.test(String(attachedPdfFile.name || ''));
    if (!isPdfMime && !isPdfName) {
      setManualContractError('Selected file is not a PDF. Please choose a .pdf file.');
      return;
    }
    console.log('[DEBUG] Starting upload. File:', attachedPdfFile.name, 'Size:', attachedPdfFile.size);
    setManualContractBusy(true);
    setManualContractError('');
    try {
      console.log('[DEBUG] Calling uploadContractPdfToCloudinary...');
      const uploaded = await uploadContractPdfToCloudinary(attachedPdfFile);
      console.log('[DEBUG] Upload successful:', uploaded);
      setManualUploadMeta({
        documentUrl: uploaded.url,
        publicId: uploaded.publicId,
        fileName: uploaded.fileName || attachedPdfFile.name,
      });
    } catch (err) {
      console.error('[DEBUG] Upload error:', err);
      setManualContractError(err?.message || 'Failed to upload contract PDF to Cloudinary.');
    } finally {
      setManualContractBusy(false);
    }
  };

  const confirmManualContract = async () => {
    if (!canManageRentalContracts) {
      setManualContractError('Only staff can confirm or renew contracts.');
      return;
    }

    const rentalId = getRentalId(rental);
    if (!rentalId) {
      setManualContractError('No rental ID found for contract creation.');
      return;
    }

    if (!tenantSignerId || !ownerSignerId || !agentSignerId) {
      setManualContractError('Tenant, Owner, and Agent IDs are all required before confirming contract.');
      return;
    }

    const missingDraftFields = requiredManualDraftKeys.filter((key) => !isFilled(manualDraft?.[key]));
    if (missingDraftFields.length) {
      const missingLabels = missingDraftFields.map((key) => manualFieldLabels[key] || key).join(', ');
      setManualContractError(`Please fill required fields: ${missingLabels}.`);
      return;
    }

    const tenantDrawnNow = captureRoleDrawnSignature('tenant');
    const ownerDrawnNow = captureRoleDrawnSignature('owner');
    const agentDrawnNow = captureRoleDrawnSignature('agent');

    const tenantSignature = String(tenantDrawnNow || signatureDrafts?.tenant?.drawn || signatureDrafts?.tenant?.uploaded || '').trim();
    const ownerSignature = String(ownerDrawnNow || signatureDrafts?.owner?.drawn || signatureDrafts?.owner?.uploaded || '').trim();
    const agentSignature = String(agentDrawnNow || signatureDrafts?.agent?.drawn || signatureDrafts?.agent?.uploaded || '').trim();

    if (!tenantSignature || !ownerSignature || !agentSignature) {
      setManualContractError('All 3 signatures are required before confirming contract.');
      return;
    }

    const signers = Array.from(new Set([tenantSignerId, ownerSignerId, agentSignerId].filter(Boolean)));
    const termsBlock = [
      `Property Reference: ${manualDraft.propertyReference || propertyReference || '-'}`,
      `Property Address: ${manualDraft.propertyAddress || '-'}`,
      `Rent Amount: ${manualDraft.rentAmount || manualDraft.paymentAmount || '-'}`,
      `Deposit Amount: ${manualDraft.depositAmount || '-'}`,
      `Agency Fees: ${manualDraft.agencyFees || '-'}`,
      `Common Charges: ${manualDraft.commonCharges || '-'}`,
      `Bills Included: ${manualDraft.billsIncluded || '-'}`,
      `Bills Details: ${manualDraft.billsDetails || '-'}`,
      `Contract Policies: ${manualDraft.contractPoliciesSummary || '-'}`,
      `House Policies: ${manualDraft.housePoliciesSummary || '-'}`,
      `Custom Policies: ${manualDraft.customPoliciesSummary || '-'}`,
      `Late Fee Rules: ${manualDraft.lateFeeRules || '-'}`,
      `Maintenance Responsibility: ${manualDraft.maintenanceResponsibility || '-'}`,
      `Special Conditions: ${manualDraft.specialConditions || '-'}`,
      `Additional Terms & Notes: ${manualDraft.additionalTerms || '-'}`,
      `Payment Frequency (months): ${manualDraft.paymentFrequency || '-'}`,
      `Auto Renewal: ${manualDraft.autoRenew}`,
    ].join('\n');

    setManualContractBusy(true);
    setManualContractError('');
    try {
      const signedAtNow = new Date().toISOString();

      const resolveAndUploadSignature = async (role, drawnFallback) => {
        const roleDraft = signatureDrafts?.[role] || { drawn: '', uploaded: '', uploadedFile: null };
        let signatureFile = roleDraft.uploadedFile || null;

        if (!signatureFile) {
          const sourceDataUrl = String(roleDraft.uploaded || drawnFallback || roleDraft.drawn || '').trim();
          if (!sourceDataUrl) {
            throw new Error(`Missing ${role} signature source.`);
          }
          signatureFile = dataUrlToFile(sourceDataUrl, `${role}-signature-${Date.now()}.png`);
        }

        const uploadedSignature = await uploadSignatureImageToCloudinary(signatureFile);
        return uploadedSignature;
      };

      const tenantSignatureUpload = await resolveAndUploadSignature('tenant', tenantDrawnNow);
      const ownerSignatureUpload = await resolveAndUploadSignature('owner', ownerDrawnNow);
      const agentSignatureUpload = await resolveAndUploadSignature('agent', agentDrawnNow);

      let documentUrl = manualUploadMeta.documentUrl;
      let publicId = manualUploadMeta.publicId;
      let fileName = manualUploadMeta.fileName;

      // Auto-upload selected PDF when a URL is not already available.
      if (!documentUrl) {
        if (!attachedPdfFile) {
          setManualContractError('Please choose a PDF file before confirming contract.');
          return;
        }
        const isPdfMime = String(attachedPdfFile.type || '').toLowerCase() === 'application/pdf';
        const isPdfName = /\.pdf$/i.test(String(attachedPdfFile.name || ''));
        if (!isPdfMime && !isPdfName) {
          setManualContractError('Selected file is not a PDF. Please choose a .pdf file.');
          return;
        }
        const uploaded = await uploadContractPdfToCloudinary(attachedPdfFile);
        documentUrl = uploaded.url;
        publicId = uploaded.publicId;
        fileName = uploaded.fileName || attachedPdfFile.name;
        setManualUploadMeta({
          documentUrl,
          publicId,
          fileName,
        });
      }

      const created = await createRentalContract({
        rentalId,
        contractType: 'manual',
        startDate: manualDraft.moveInDate || undefined,
        endDate: manualDraft.moveOutDate || undefined,
        terms: termsBlock,
        documentUrl,
        publicId: publicId || undefined,
        fileName: fileName || undefined,
        notes: manualDraft.additionalTerms || undefined,
        signedBy: signers,
        signatureTimestamps: {
          [tenantSignerId]: signedAtNow,
          [ownerSignerId]: signedAtNow,
          [agentSignerId]: signedAtNow,
        },
        expiresAt: plusYears(manualDraft.moveOutDate),
        isArchived: false,
      });

      const createdContractId = created?._id || created?.id || '';
      if (!createdContractId) {
        throw new Error('Contract created without valid ID.');
      }

      await signRentalContract(createdContractId, {
        signature: tenantSignatureUpload.url,
        signerRole: 'tenant',
        signedAt: signedAtNow,
        signatureImageUrl: tenantSignatureUpload.url,
        signatureImagePublicId: tenantSignatureUpload.publicId,
        notes: 'Tenant signed via contract modal',
      });
      await signRentalContract(createdContractId, {
        signature: ownerSignatureUpload.url,
        signerRole: 'owner',
        signedAt: signedAtNow,
        signatureImageUrl: ownerSignatureUpload.url,
        signatureImagePublicId: ownerSignatureUpload.publicId,
        notes: 'Owner signed via contract modal',
      });
      await signRentalContract(createdContractId, {
        signature: agentSignatureUpload.url,
        signerRole: 'agent',
        signedAt: signedAtNow,
        signatureImageUrl: agentSignatureUpload.url,
        signatureImagePublicId: agentSignatureUpload.publicId,
        notes: 'Agent signed via contract modal',
      });

      setActiveContractId(createdContractId);
      await refreshDocumentsData(rentalId);
    } catch (err) {
      setManualContractError(err?.response?.data?.message || err?.message || 'Failed to confirm contract.');
    } finally {
      setManualContractBusy(false);
    }
  };

  const signContractByRole = async (role) => {
    if (!canManageRentalContracts) {
      setManualContractError('Only staff can submit contract signatures from this screen.');
      return;
    }

    if (!resolvedContractId) {
      setManualContractError('Create or select a contract first before signing.');
      return;
    }
    const drawnNow = captureRoleDrawnSignature(role);
    const roleDraft = signatureDrafts?.[role] || { drawn: '', uploaded: '' };
    const signatureValue = String(drawnNow || roleDraft.drawn || roleDraft.uploaded || '').trim();
    if (!signatureValue) {
      setManualContractError(`Provide a ${role} signature (draw or upload image) before signing.`);
      return;
    }
    setManualContractBusy(true);
    setManualContractError('');
    try {
      await signRentalContract(resolvedContractId, {
        signature: signatureValue,
        signerRole: role,
      });
      await refreshDocumentsData(getRentalId(rental));
    } catch (err) {
      const fallbackMessage = role === 'agent'
        ? 'Agent signing is not available on backend yet. Tenant/Owner signatures remain supported.'
        : 'Failed to sign contract.';
      setManualContractError(err?.response?.data?.message || err?.message || fallbackMessage);
    } finally {
      setManualContractBusy(false);
    }
  };

  const archiveContractHandler = async (contractId) => {
    if (!canManageRentalContracts) {
      setDocsError('Only staff can archive contracts.');
      return;
    }

    if (!contractId) return;
    setDocsBusy(true);
    setDocsError('');
    try {
      await archiveRentalContract(contractId);
      await refreshDocumentsData(getRentalId(rental));
    } catch (err) {
      setDocsError(err?.response?.data?.message || err?.message || 'Failed to archive contract.');
    } finally {
      setDocsBusy(false);
    }
  };

  const downloadContractHandler = async (contractId) => {
    if (!contractId) return;
    setDocsBusy(true);
    setDocsError('');
    try {
      const payload = await getContractDownload(contractId);
      triggerDownload(payload?.url, payload?.fileName);
    } catch (err) {
      setDocsError(err?.response?.data?.message || err?.message || 'Failed to download contract.');
    } finally {
      setDocsBusy(false);
    }
  };

  const handleDocumentFileUpload = async (file) => {
    if (!canUploadDocuments) {
      setDocsError('You are not allowed to upload documents for this rental.');
      return;
    }

    if (!file) return;
    console.log('[DEBUG] Document file upload started:', file.name, file.type, file.size);
    setDocsBusy(true);
    setDocsError('');
    try {
      console.log('[DEBUG] Uploading to Cloudinary...');
      const response = await uploadContractPdfToCloudinary(file);
      console.log('[DEBUG] Cloudinary response:', response);

      const uploadedUrl = String(response?.url || response?.secure_url || '');
      const uploadedPublicId = String(response?.publicId || response?.public_id || '');
      const uploadedFileName = String(response?.fileName || response?.original_filename || file.name || '');

      if (uploadedUrl) {
        setDocumentForm((prev) => ({
          ...prev,
          documentUrl: uploadedUrl,
          publicId: uploadedPublicId,
          fileName: uploadedFileName,
        }));
        console.log('[DEBUG] Document file uploaded successfully:', uploadedUrl);
      } else {
        setDocsError('Failed to upload file to Cloudinary');
        console.error('[DEBUG] Invalid Cloudinary response:', response);
      }
    } catch (err) {
      console.error('[DEBUG] File upload error:', err);
      setDocsError(err?.message || 'Failed to upload file');
    } finally {
      setDocsBusy(false);
    }
  };

  const createDocumentHandler = async () => {
    if (!canUploadDocuments) {
      setDocsError('You are not allowed to create documents for this rental.');
      return;
    }

    const rentalId = getRentalId(rental);
    console.log('[DEBUG] Creating document with rentalId:', rentalId);
    console.log('[DEBUG] DocumentForm data:', documentForm);

    if (!rentalId) {
      setDocsError('No rental ID found for document creation.');
      console.error('[DEBUG] No rental ID');
      return;
    }
    if (!documentForm.documentType || !documentForm.title || !documentForm.documentUrl) {
      const missing = [];
      if (!documentForm.documentType) missing.push('documentType');
      if (!documentForm.title) missing.push('title');
      if (!documentForm.documentUrl) missing.push('documentUrl');
      setDocsError(`Missing required fields: ${missing.join(', ')}`);
      console.error('[DEBUG] Missing fields:', missing);
      return;
    }
    setDocsBusy(true);
    setDocsError('');
    try {
      console.log('[DEBUG] Calling createRentalDocument API...');
      await createRentalDocument({
        rentalId,
        documentType: documentForm.documentType,
        title: documentForm.title,
        description: documentForm.description || undefined,
        documentUrl: documentForm.documentUrl,
        publicId: documentForm.publicId || undefined,
        fileName: documentForm.fileName || undefined,
        isPublic: Boolean(documentForm.isPublic),
        expiresAt: documentForm.expiresAt ? new Date(documentForm.expiresAt).toISOString() : undefined,
        notes: documentForm.notes || undefined,
      });
      console.log('[DEBUG] Document created successfully');
      await refreshDocumentsData(rentalId, documentTypeFilter);
      setDocumentForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        documentUrl: '',
        publicId: '',
        fileName: '',
        expiresAt: '',
        notes: '',
      }));
      setShowUploadDocumentModal(false);
    } catch (err) {
      console.error('[DEBUG] Document creation error:', err);
      setDocsError(err?.response?.data?.message || err?.message || 'Failed to create document.');
    } finally {
      setDocsBusy(false);
    }
  };

  const downloadDocumentHandler = async (documentId) => {
    if (!documentId) return;
    setDocsBusy(true);
    setDocsError('');
    try {
      const payload = await getDocumentDownload(documentId);
      triggerDownload(payload?.url, payload?.fileName);
    } catch (err) {
      setDocsError(err?.response?.data?.message || err?.message || 'Failed to download document.');
    } finally {
      setDocsBusy(false);
    }
  };

  const deleteDocumentHandler = async (documentId) => {
    if (!canDeleteDocuments) {
      setDocsError('Only staff can delete documents.');
      return;
    }

    if (!documentId) return;
    setDocsBusy(true);
    setDocsError('');
    try {
      await deleteRentalDocument(documentId);
      await refreshDocumentsData(getRentalId(rental), documentTypeFilter);
    } catch (err) {
      setDocsError(err?.response?.data?.message || err?.message || 'Failed to delete document.');
    } finally {
      setDocsBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!propertyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const [propertyData, rentals] = await Promise.all([
          getProperty(propertyId),
          getRentalsByProperty(propertyId),
        ]);
        if (!mounted) return;

        setProperty(propertyData);

        const rentalsList = Array.isArray(rentals) ? rentals : [];
        const activeRentals = rentalsList.filter((r) => {
          const status = String(r?.status || '').toLowerCase();
          return status === 'rented' || status === 'active' || status === 'renewal';
        });

        const findByRentalId = (list, rentalId) => {
          if (!rentalId) return null;
          return list.find((item) => getRentalId(item) === rentalId) || null;
        };

        const findByParticipant = (list, participantField) => {
          if (!currentUserId) return null;
          return list.find((item) => resolveEntityId(item?.[participantField]) === currentUserId) || null;
        };

        let selectedRental =
          findByRentalId(activeRentals, requestedRentalId)
          || findByRentalId(rentalsList, requestedRentalId)
          || null;

        if (!selectedRental && requestedChatThread === RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT) {
          selectedRental = findByParticipant(activeRentals, 'tenantId') || findByParticipant(rentalsList, 'tenantId');
        }

        if (!selectedRental && requestedChatThread === RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER) {
          selectedRental = findByParticipant(activeRentals, 'ownerId') || findByParticipant(rentalsList, 'ownerId');
        }

        if (!selectedRental) {
          selectedRental =
            findByParticipant(activeRentals, 'tenantId')
            || findByParticipant(activeRentals, 'ownerId')
            || findByParticipant(activeRentals, 'agentId')
            || findByParticipant(rentalsList, 'tenantId')
            || findByParticipant(rentalsList, 'ownerId')
            || findByParticipant(rentalsList, 'agentId')
            || activeRentals[0]
            || rentalsList[0]
            || null;
        }

        let selectedRentalData = selectedRental;
        const selectedRentalId = getRentalId(selectedRental);

        if (selectedRentalId) {
          try {
            const rentalDetails = await getRentalById(selectedRentalId);
            if (rentalDetails && typeof rentalDetails === 'object') {
              selectedRentalData = { ...selectedRental, ...rentalDetails };
            }
          } catch {
            // Keep list payload when rental detail endpoint fails.
          }
        }

        setRental(selectedRentalData);

        const listingRef = selectedRentalData?.propertyListingId && typeof selectedRentalData.propertyListingId === 'object'
          ? selectedRentalData.propertyListingId
          : (selectedRentalData?.propertyListing && typeof selectedRentalData.propertyListing === 'object'
            ? selectedRentalData.propertyListing
            : null);
        if (listingRef) {
          setListing(listingRef);
        }

        const extractUserId = (value) => resolveEntityId(value);
        const tenantRef = selectedRentalData?.tenantId;
        const ownerRef = selectedRentalData?.ownerId || propertyData?.ownerId;
        const agentRef = selectedRentalData?.agentId || propertyData?.createdBy || propertyData?.agent_id;

        const tenantId = extractUserId(tenantRef);
        const ownerId = extractUserId(ownerRef);
        const agentId = extractUserId(agentRef);

        if (mounted) {
          setTenant(tenantRef && typeof tenantRef === 'object' ? tenantRef : null);
          setOwner(ownerRef && typeof ownerRef === 'object' ? ownerRef : null);
          setAgent(agentRef && typeof agentRef === 'object' ? agentRef : null);
          // Render page as soon as core property+rental data is ready.
          setLoading(false);
        }

        if (selectedRentalId) {
          void refreshRentalFinanceData(selectedRentalId, { silent: true });
          void refreshDocumentsData(selectedRentalId);

          void (async () => {
            try {
              const startPayload = await startRentalConversation(selectedRentalId);
              let nextConversationIds = {
                ...createEmptyConversationMap(),
                ...extractConversationIds(startPayload),
              };

              if (!nextConversationIds[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER]
                && !nextConversationIds[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT]) {
                try {
                  const conversationsPayload = await getRentalConversations(selectedRentalId);
                  const listedConversationIds = extractConversationIds(conversationsPayload);
                  nextConversationIds = {
                    [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER]: listedConversationIds[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER] || '',
                    [RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT]: listedConversationIds[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT] || '',
                  };
                } catch {
                  // Keep the ids returned by start endpoint if conversations listing is unavailable.
                }
              }

              const threadResults = await Promise.all(CHAT_THREAD_ORDER.map(async (threadType) => {
                const threadConversationId = String(nextConversationIds[threadType] || '').trim();
                if (!threadConversationId) {
                  return { threadType, conversationId: '', messages: [], error: null, forbidden: false };
                }

                try {
                  const chatMessages = await getRentalConversationMessages(threadConversationId);
                  return {
                    threadType,
                    conversationId: threadConversationId,
                    messages: Array.isArray(chatMessages) ? chatMessages : [],
                    error: null,
                    forbidden: false,
                  };
                } catch (fetchErr) {
                  if (isConversationNotFoundError(fetchErr)) {
                    try {
                      const restart = await startRentalConversation(selectedRentalId, threadType);
                      const restartedConversationId = extractConversationId(restart, threadType);
                      if (!restartedConversationId) {
                        throw fetchErr;
                      }
                      const restartedMessages = await getRentalConversationMessages(restartedConversationId);
                      return {
                        threadType,
                        conversationId: String(restartedConversationId),
                        messages: Array.isArray(restartedMessages) ? restartedMessages : [],
                        error: null,
                        forbidden: false,
                      };
                    } catch (restartFetchErr) {
                      return {
                        threadType,
                        conversationId: threadConversationId,
                        messages: [],
                        error: restartFetchErr,
                        forbidden: restartFetchErr?.response?.status === 403,
                      };
                    }
                  }

                  return {
                    threadType,
                    conversationId: threadConversationId,
                    messages: [],
                    error: fetchErr,
                    forbidden: fetchErr?.response?.status === 403,
                  };
                }
              }));

              if (mounted) {
                const nextMessagesByConversation = createEmptyMessagesMap();
                const resolvedConversationIds = createEmptyConversationMap();
                const nonForbiddenErrors = [];

                threadResults.forEach((result) => {
                  resolvedConversationIds[result.threadType] = String(result.conversationId || '').trim();
                  nextMessagesByConversation[result.threadType] = Array.isArray(result.messages) ? result.messages : [];
                  if (result.error && !result.forbidden) {
                    nonForbiddenErrors.push(result.error);
                  }
                });

                setConversationIds(resolvedConversationIds);
                setMessagesByConversation(nextMessagesByConversation);

                const hasAnyConversation = Boolean(
                  resolvedConversationIds[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER]
                  || resolvedConversationIds[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT],
                );

                if (!hasAnyConversation) {
                  setChatError('Conversation was not initialized for this rental.');
                } else if (nonForbiddenErrors.length) {
                  const firstError = nonForbiddenErrors[0];
                  setChatError(firstError?.response?.data?.message || firstError?.message || 'Conversation not available for this user.');
                } else {
                  setChatError('');
                }
              }
            } catch (chatInitError) {
              if (mounted) {
                setConversationIds(createEmptyConversationMap());
                setMessagesByConversation(createEmptyMessagesMap());
                setChatError(chatInitError?.response?.data?.message || chatInitError?.message || 'Failed to initialize chat conversation.');
              }
            }
          })();
        } else if (mounted) {
          setConversationIds(createEmptyConversationMap());
          setMessagesByConversation(createEmptyMessagesMap());
          setChatError('No rental id found for this property. Chat is unavailable.');
        }

        void Promise.allSettled([
          tenantId
            ? getUser(String(tenantId)).then((tenantData) => {
              if (mounted) setTenant(tenantData);
            }).catch(() => {
              if (mounted && (!tenantRef || typeof tenantRef !== 'object')) setTenant(null);
            })
            : Promise.resolve(),
          ownerId
            ? getUser(String(ownerId)).then((ownerData) => {
              if (mounted) setOwner(ownerData);
            }).catch(() => {
              if (mounted && (!ownerRef || typeof ownerRef !== 'object')) setOwner(null);
            })
            : Promise.resolve(),
          agentId
            ? getUser(String(agentId)).then((agentData) => {
              if (mounted) setAgent(agentData);
            }).catch(() => {
              if (mounted && (!agentRef || typeof agentRef !== 'object')) setAgent(null);
            })
            : Promise.resolve(),
        ]);
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.message || err?.message || 'Failed to load rented property details');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [propertyId, currentUserId, requestedChatThread, requestedRentalId]);

  useEffect(() => {
    if (!propertyId) return;
    if (listing && (listing._id || listing.id)) return;
    let cancelled = false;
    getActiveListing(propertyId).catch(() => null)
      .then(activeListing => {
        if (!cancelled && activeListing) setListing(activeListing);
      });
    return () => { cancelled = true; };
  }, [propertyId, listing?._id, listing?.id]);

  useEffect(() => {
    if (!property?.branchId) return;
    let cancelled = false;
    getBranchById(property.branchId).then(b => { if (!cancelled && b) setBranchName(b.name); }).catch(() => { });
    return () => { cancelled = true; };
  }, [property?.branchId]);

  const expiryBadge = useMemo(() => getExpiryBadge(rental), [rental]);

  const rentalCurrency = useMemo(() => {
    return String(rental?.currency || stripeDraft.currency || 'tnd').toUpperCase();
  }, [rental?.currency, stripeDraft.currency]);

  const totalIncome = useMemo(() => {
    return paymentSchedule.reduce((sum, p) => sum + getScheduleAmount(p), 0);
  }, [paymentSchedule]);

  const paidCount = useMemo(() => paymentSchedule.filter((p) => isScheduleRowPaid(p)).length, [paymentSchedule]);

  const paymentTrackingTimeline = useMemo(() => {
    return Array.isArray(paymentTracking?.timeline) ? paymentTracking.timeline : [];
  }, [paymentTracking]);

  const paymentTrackingRows = useMemo(() => {
    return paymentTrackingTimeline.map((month, monthIndex) => {
      const tranches = Array.isArray(month?.tranches) ? month.tranches : [];
      const invoices = Array.isArray(month?.invoices) ? month.invoices : [];
      const paidAmount = roundToMoney(month?.totalPaid);
      const dueAmount = roundToMoney(month?.totalDue);
      const balanceAmount = Math.max(roundToMoney(dueAmount - paidAmount), 0);

      const agencyAmount = roundToMoney(invoices.reduce((sum, entry) => {
        return sum + toSafeNumber(entry?.invoice?.paymentBreakdown?.agencyFeeAmount);
      }, 0));

      const depositAmount = roundToMoney(invoices.reduce((sum, entry) => {
        return sum + toSafeNumber(entry?.invoice?.paymentBreakdown?.depositAmount);
      }, 0));

      const rentAmount = roundToMoney(invoices.reduce((sum, entry) => {
        return sum + toSafeNumber(entry?.invoice?.paymentBreakdown?.rentAmount);
      }, 0));

      const candidateDates = [
        ...tranches.map((line) => line?.paidAt),
        ...invoices.map((entry) => entry?.invoice?.date || entry?.invoice?.updatedAt || entry?.invoice?.createdAt),
      ]
        .map((value) => new Date(value || 0).getTime())
        .filter((value) => Number.isFinite(value) && value > 0);

      const lastPaymentAt = candidateDates.length
        ? new Date(Math.max(...candidateDates)).toISOString()
        : '';

      return {
        ...month,
        rowKey: `${month?.periodStart || monthIndex}-${month?.periodEnd || monthIndex}`,
        tranches,
        invoices,
        paidAmount,
        dueAmount,
        balanceAmount,
        agencyAmount,
        depositAmount,
        rentAmount,
        lastPaymentAt,
      };
    });
  }, [paymentTrackingTimeline]);

  const trackingTotals = useMemo(() => {
    return paymentTrackingRows.reduce((acc, month) => {
      acc.totalPaid += toSafeNumber(month?.paidAmount);
      acc.totalDue += toSafeNumber(month?.dueAmount);
      acc.totalAgency += toSafeNumber(month?.agencyAmount);
      acc.totalDeposit += toSafeNumber(month?.depositAmount);
      acc.totalRent += toSafeNumber(month?.rentAmount);
      acc.overdueMonths += normalizeTrackingMonthStatus(month?.status) === 'OVERDUE' ? 1 : 0;
      return acc;
    }, {
      totalPaid: 0,
      totalDue: 0,
      totalAgency: 0,
      totalDeposit: 0,
      totalRent: 0,
      overdueMonths: 0,
    });
  }, [paymentTrackingRows]);

  const lastTrackedPaymentDate = useMemo(() => {
    const latestMs = paymentTrackingRows
      .map((month) => new Date(month?.lastPaymentAt || 0).getTime())
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b - a)[0];

    return latestMs ? new Date(latestMs).toISOString() : '';
  }, [paymentTrackingRows]);

  const onTimeRate = useMemo(() => {
    if (!paymentSchedule.length) return 0;
    return Math.round((paidCount / paymentSchedule.length) * 100);
  }, [paymentSchedule, paidCount]);

  const outstandingBalance = useMemo(() => {
    const rentalOutstanding = Number(rental?.outstandingBalance);
    if (Number.isFinite(rentalOutstanding)) return rentalOutstanding;

    return paymentSchedule
      .filter((p) => !isScheduleRowPaid(p))
      .reduce((sum, p) => sum + getScheduleBalanceDue(p), 0);
  }, [paymentSchedule, rental?.outstandingBalance]);

  const nextPayment = useMemo(() => {
    return paymentSchedule.find((p) => !isScheduleRowPaid(p)) || null;
  }, [paymentSchedule]);

  const monthlyPaymentAmount = useMemo(() => {
    return firstDefinedNumber(rental?.amount, property?.price, nextPayment ? getScheduleAmount(nextPayment) : 0);
  }, [rental?.amount, property?.price, nextPayment]);

  const lastPaymentDate = useMemo(() => {
    if (rental?.lastPaymentDate) return rental.lastPaymentDate;

    const paidRows = paymentSchedule
      .filter((item) => isScheduleRowPaid(item))
      .sort((a, b) => {
        const aTime = new Date(a?.paidAt || a?.dueDate || 0).getTime();
        const bTime = new Date(b?.paidAt || b?.dueDate || 0).getTime();
        return bTime - aTime;
      });

    const latest = paidRows[0];
    return latest?.paidAt || latest?.dueDate || '';
  }, [rental?.lastPaymentDate, paymentSchedule]);

  const nextPaymentDueDate = useMemo(() => {
    return rental?.nextPaymentDue || nextPayment?.dueDate || nextPayment?.billingPeriodEnd || '';
  }, [rental?.nextPaymentDue, nextPayment]);

  const typeLabel = TYPE_LABELS[property?.propertyType] ?? (property?.propertyType || '-');

  const isAgentConversationRole = useMemo(() => {
    return [
      'real_estate_agent',
      'rental_manager',
      'branch_manager',
      'super_admin',
      'admin',
    ].includes(currentUserRole);
  }, [currentUserRole]);

  const currentUserMatchesOwner = useMemo(() => {
    return Boolean(currentUserId && ownerSignerId && currentUserId === ownerSignerId);
  }, [currentUserId, ownerSignerId]);

  const currentUserMatchesTenant = useMemo(() => {
    return Boolean(currentUserId && tenantSignerId && currentUserId === tenantSignerId);
  }, [currentUserId, tenantSignerId]);

  const currentUserMatchesAgent = useMemo(() => {
    return Boolean(currentUserId && agentSignerId && currentUserId === agentSignerId);
  }, [currentUserId, agentSignerId]);

  const isStaffRentalUser = useMemo(() => {
    return [
      'real_estate_agent',
      'rental_manager',
      'branch_manager',
      'super_admin',
      'admin',
      'accountant',
    ].includes(currentUserRole) || currentUserMatchesAgent;
  }, [currentUserRole, currentUserMatchesAgent]);

  const canManageRentalContracts = isStaffRentalUser;
  const canManageCriticalRentalActions = isStaffRentalUser;
  const canDeleteDocuments = isStaffRentalUser;
  const canUploadDocuments = Boolean(
    isStaffRentalUser || currentUserMatchesOwner || currentUserMatchesTenant || currentUserMatchesAgent,
  );

  const hasStripeKey = Boolean(stripePromise && STRIPE_PUBLISHABLE_KEY);
  const canInitiatePayments = currentUserMatchesTenant;

  const listingFees = useMemo(() => {
    return listing?.fees || listing?.policies?.fees || {};
  }, [listing]);

  const strictMonthlyRentAmount = useMemo(() => {
    return firstDefinedNumber(
      listingFees?.rentAmount,
      rental?.amount,
      property?.price,
    );
  }, [listingFees, rental?.amount, property?.price]);

  const strictAgencyFeeAmount = useMemo(() => {
    return firstDefinedNumber(
      listingFees?.agencyFees,
      listing?.agencyFees,
      fees?.agencyFees,
      rental?.agencyFeeAmount,
      0,
    );
  }, [listingFees, listing?.agencyFees, fees?.agencyFees, rental?.agencyFeeAmount]);

  const strictDepositAmount = useMemo(() => {
    return firstDefinedNumber(
      listingFees?.depositAmount,
      listing?.depositAmount,
      rental?.depositAmount,
      fees?.depositAmount,
      0,
    );
  }, [listingFees, listing?.depositAmount, rental?.depositAmount, fees?.depositAmount]);

  const hasAnyPaidInstallment = useMemo(() => {
    return paymentSchedule.some((item) => {
      if (isScheduleRowPaid(item)) return true;
      return toSafeNumber(item?.amountPaid) > 0;
    });
  }, [paymentSchedule]);

  const isFirstTenantPaymentMonth = useMemo(() => {
    return !hasAnyPaidInstallment;
  }, [hasAnyPaidInstallment]);

  const strictExpectedTenantPaymentAmount = useMemo(() => {
    const baseAmount = strictMonthlyRentAmount + strictAgencyFeeAmount;
    const firstMonthExtra = isFirstTenantPaymentMonth ? strictDepositAmount : 0;
    return roundToMoney(baseAmount + firstMonthExtra);
  }, [strictMonthlyRentAmount, strictAgencyFeeAmount, strictDepositAmount, isFirstTenantPaymentMonth]);

  const strictExpectedTenantPaymentSummary = useMemo(() => {
    const parts = [
      `rent (${formatMoney(strictMonthlyRentAmount)})`,
      `agency fee (${formatMoney(strictAgencyFeeAmount)})`,
    ];

    if (isFirstTenantPaymentMonth) {
      parts.push(`deposit (${formatMoney(strictDepositAmount)})`);
    }

    return `${parts.join(' + ')} = ${formatMoney(strictExpectedTenantPaymentAmount)} ${rentalCurrency}`;
  }, [
    strictMonthlyRentAmount,
    strictAgencyFeeAmount,
    strictDepositAmount,
    isFirstTenantPaymentMonth,
    strictExpectedTenantPaymentAmount,
    rentalCurrency,
  ]);

  const getTenantAmountValidationMessage = (amountValue) => {
    if (!canInitiatePayments) return '';
    if (strictExpectedTenantPaymentAmount <= 0) return '';

    const amount = roundToMoney(amountValue);
    const delta = Math.abs(amount - strictExpectedTenantPaymentAmount);
    if (delta <= 0.01) return '';

    return `Invalid amount. Required amount is ${strictExpectedTenantPaymentSummary}.`;
  };

  const strictTenantMonthlyRuleApplies = false;

  useEffect(() => {
    if (!strictTenantMonthlyRuleApplies) return;

    const expectedAmount = String(strictExpectedTenantPaymentAmount);

    setStripeDraft((prev) => {
      if (String(prev.amount || '').trim()) return prev;
      return { ...prev, amount: expectedAmount };
    });

    setOfflineDraft((prev) => {
      if (String(prev.amount || '').trim()) return prev;
      return { ...prev, amount: expectedAmount };
    });
  }, [strictTenantMonthlyRuleApplies, strictExpectedTenantPaymentAmount]);

  const sortedPaymentActivity = useMemo(() => {
    return [...paymentActivity].sort((a, b) => {
      const aTime = new Date(a?.createdAt || 0).getTime();
      const bTime = new Date(b?.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [paymentActivity]);

  const stalePendingPayments = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return sortedPaymentActivity.filter((entry) => {
      const status = normalizePaymentStatus(entry?.status);
      if (status !== PAYMENT_STATUS.PENDING) return false;
      const createdAtMs = new Date(entry?.createdAt || 0).getTime();
      if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) return false;
      return now - createdAtMs >= sevenDaysMs;
    });
  }, [sortedPaymentActivity]);

  const canAccessAgentOwner = useMemo(() => {
    if (isAgentConversationRole || currentUserMatchesAgent) return true;
    return currentUserMatchesOwner;
  }, [isAgentConversationRole, currentUserMatchesAgent, currentUserMatchesOwner]);

  const canAccessAgentTenant = useMemo(() => {
    if (isAgentConversationRole || currentUserMatchesAgent) return true;
    return currentUserMatchesTenant;
  }, [isAgentConversationRole, currentUserMatchesAgent, currentUserMatchesTenant]);

  const allowedThreadTypes = useMemo(() => {
    const nextTypes = [];

    if (canAccessAgentOwner && conversationIds[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER]) {
      nextTypes.push(RENTAL_CHAT_CONVERSATION_TYPES.AGENT_OWNER);
    }
    if (canAccessAgentTenant && conversationIds[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT]) {
      nextTypes.push(RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT);
    }

    return nextTypes;
  }, [canAccessAgentOwner, canAccessAgentTenant, conversationIds]);

  useEffect(() => {
    if (!allowedThreadTypes.length) return;

    if (requestedChatThread && allowedThreadTypes.includes(requestedChatThread)) {
      setActiveConversationType(requestedChatThread);
      return;
    }

    if (!allowedThreadTypes.includes(activeConversationType)) {
      setActiveConversationType(allowedThreadTypes[0]);
    }
  }, [allowedThreadTypes, requestedChatThread, activeConversationType]);

  const activeConversationId = String(conversationIds[activeConversationType] || '').trim();
  const activeThreadMessages = messagesByConversation[activeConversationType] || [];
  const activeThreadMeta = CHAT_THREAD_META[activeConversationType] || CHAT_THREAD_META[RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT];
  const activeThreadDraft = String(chatDrafts[activeConversationType] || '');
  const isActiveThreadSending = Boolean(chatSending[activeConversationType]);

  const loadThreadMessages = async (threadType, conversationIdOverride) => {
    const threadConversationId = String(conversationIdOverride || conversationIds[threadType] || '').trim();
    if (!threadConversationId) {
      setThreadMessages(threadType, []);
      return;
    }

    try {
      const chatMessages = await getRentalConversationMessages(threadConversationId);
      setThreadMessages(threadType, chatMessages);
    } catch (err) {
      if (isConversationNotFoundError(err)) {
        await recoverConversation(threadType);
        return;
      }

      if (err?.response?.status === 403) {
        setThreadMessages(threadType, []);
        return;
      }

      throw err;
    }
  };

  const sendThreadMessage = async (threadType) => {
    const normalizedThreadType = normalizeChatThread(threadType);
    const threadConversationId = String(conversationIds[normalizedThreadType] || '').trim();
    const messageText = String(chatDrafts[normalizedThreadType] || '').trim();

    if (!normalizedThreadType || !messageText || !threadConversationId) {
      if (!threadConversationId) {
        setChatError('Conversation is not ready yet. Please refresh this page.');
      }
      return false;
    }

    try {
      setChatSending((prev) => ({ ...prev, [normalizedThreadType]: true }));
      setChatError('');

      if (socketRef.current && socketConnected) {
        sendRentalSocketMessage(socketRef.current, threadConversationId, messageText);
      } else {
        await sendRentalConversationMessage(threadConversationId, messageText, 'all');
      }

      setChatDrafts((prev) => ({ ...prev, [normalizedThreadType]: '' }));
      await loadThreadMessages(normalizedThreadType, threadConversationId);
      return true;
    } catch (sendError) {
      setChatError(sendError?.response?.data?.message || sendError?.message || 'Failed to send chat message.');
      return false;
    } finally {
      setChatSending((prev) => ({ ...prev, [normalizedThreadType]: false }));
    }
  };

  useEffect(() => {
    const joinedThreadTypes = allowedThreadTypes.filter((threadType) => {
      const threadConversationId = String(conversationIds[threadType] || '').trim();
      return Boolean(threadConversationId);
    });

    if (!joinedThreadTypes.length) return undefined;

    const token = localStorage.getItem('access_token') || '';
    if (!token) {
      setChatError('Missing token for real-time chat; using HTTP fallback.');
      return undefined;
    }

    const socket = createRentalChatSocketWithNamespace(token);
    socketRef.current = socket;

    const joinAllConversations = () => {
      joinedThreadTypes.forEach((threadType) => {
        const conversationIdToJoin = String(conversationIds[threadType] || '').trim();
        if (conversationIdToJoin) {
          joinRentalConversationSocket(socket, conversationIdToJoin);
        }
      });
    };

    const handleConnect = () => {
      setSocketConnected(true);
      joinAllConversations();
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleConnectError = (err) => {
      setSocketConnected(false);
      setChatError(err?.message || 'Socket connection failed; using HTTP fallback.');
    };

    const handleSocketError = (err) => {
      setChatError(typeof err === 'string' ? err : (err?.message || 'Socket event error'));
    };

    const handleNewMessage = (payload) => {
      const payloadConversationId = String(
        payload?.conversationId
        || payload?.conversation?._id
        || payload?.message?.conversationId
        || '',
      ).trim();

      const matchingThreadType = CHAT_THREAD_ORDER.find((threadType) => {
        const threadConversationId = String(conversationIds[threadType] || '').trim();
        return payloadConversationId && payloadConversationId === threadConversationId;
      });

      if (matchingThreadType) {
        loadThreadMessages(matchingThreadType).catch(() => {
          // Ignore background refresh failures triggered by websocket events.
        });
        return;
      }

      if (!payloadConversationId) {
        joinedThreadTypes.forEach((threadType) => {
          loadThreadMessages(threadType).catch(() => {
            // Ignore background refresh failures triggered by websocket events.
          });
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('error', handleSocketError);
    socket.on('new-message', handleNewMessage);
    socket.on('newMessage', handleNewMessage);

    joinAllConversations();

    const intervalId = window.setInterval(() => {
      // Poll only as a fallback when socket is disconnected.
      if (socket.connected) return;
      joinedThreadTypes.forEach((threadType) => {
        loadThreadMessages(threadType).catch(() => {
          // Ignore background refresh failures from polling.
        });
      });
    }, 12000);

    return () => {
      window.clearInterval(intervalId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('error', handleSocketError);
      socket.off('new-message', handleNewMessage);
      socket.off('newMessage', handleNewMessage);
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [allowedThreadTypes, conversationIds]);



  if (loading) {
    return <section className="p-4 md:p-6 text-sm text-app_grey">Loading rented property details...</section>;
  }

  if (error) {
    return (
      <section className="h-screen flex items-center justify-center p-4 md:p-6">
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <p className="text-sm text-gray-400">{error || 'Not found'}</p>
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-app_blue text-white flex items-center justify-center hover:bg-app_blue/90 transition-all">
            <FiArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-app_whiteCustom">
      {/* Fixed Header */}
      {/* Fixed Header */}
      <div className="bg-white m-2 px-4 rounded-2xl sticky top-0 z-20 py-3 shadow-lg">
        {/* Row 1: Back button, Title, Ref, Status, View button */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E6EBF2]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-7 h-7 rounded-full hover:bg-app_blue flex items-center justify-center text-app_grey hover:text-white transition-colors"
            >
              <FiArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-0.5 h-4 rounded-full bg-app_yellow" />
            <span className="text-sm font-semibold text-app_blue uppercase tracking-wide">
              Rented Property Detail
            </span>
            {listing?.referenceNumber && (
              <span className="text-xs font-medium text-app_grey px-3 py-0.5 bg-gray-50 rounded-full">
                Ref: {listing.referenceNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {rental?.status && (
              <span className={`text-xs font-semibold capitalize px-3 py-1 rounded-full ${rental.status.toLowerCase() === 'pending' ? 'bg-orange-100 text-orange-700' :
                rental.status.toLowerCase() === 'rented' ? 'bg-green-100 text-green-700' :
                  rental.status.toLowerCase() === 'ended' ? 'bg-blue-100 text-blue-700' :
                    rental.status.toLowerCase() === 'terminated' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                }`}>
                {rental.status}
              </span>
            )}
            <button
              onClick={() => navigate(`/real-estate-agent-space/properties/${property?._id || property?.id}`)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-app_blue hover:bg-app_blue hover:text-white transition-colors border border-app_blue/20"
              title="View Property"
            >
              <FiEye size={14} />
            </button>
          </div>
        </div>

        {/* Row 2 & 3: Combined into 3-column layout */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-5 py-1 border-b border-[#E6EBF2] items-center">
          {/* Left Column: Property Info */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-app_blue">
              {property?.title || typeLabel}
            </h1>

            <div className="flex items-start gap-1.5">
              <IcPin s={16} className="shrink-0 mt-0.5 text-app_grey" />

              <p className="text-xs text-app_grey leading-relaxed">
                {showFullAddress
                  ? property.address
                  : `${property.address?.slice(0, 50)}${property.address?.length > 50 ? '...' : ''
                  }`}

                {property.address?.length > 50 && (
                  <button
                    onClick={() => setShowFullAddress(!showFullAddress)}
                    className="ml-1 text-app_blue hover:text-app_blue/80 font-medium"
                  >
                    {showFullAddress ? 'less' : 'more'}
                  </button>
                )}
              </p>
            </div>
            {branchName && (
              <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-app_grey/10 text-app_grey w-fit">
                {branchName}
              </span>
            )}
          </div>

          {/* Property Specs */}
          <div className="grid grid-cols-[max-content_max-content] gap-x-6 gap-y-3">
            {/* Bedrooms */}
            <div className="flex items-center gap-2">
              <FiHome className="w-4 h-4 text-app_blue" />
              <div className="flex flex-col">
                <span className="text-base font-bold text-app_blue leading-tight">
                  {property?.bedrooms || '—'}
                </span>
                <span className="text-xs font-medium text-app_grey">
                  Bedrooms
                </span>
              </div>
            </div>

            {/* Bathrooms */}
            <div className="flex items-center gap-2">
              <FiDroplet className="w-4 h-4 text-app_blue" />
              <div className="flex flex-col">
                <span className="text-base font-bold text-app_blue leading-tight">
                  {property?.bathrooms || '—'}
                </span>
                <span className="text-xs font-medium text-app_grey">
                  Bathrooms
                </span>
              </div>
            </div>

            {/* Floor */}
            <div className="flex items-center gap-2">
              <FiLayers className="w-4 h-4 text-app_blue" />
              <div className="flex flex-col">
                <span className="text-base font-bold text-app_blue leading-tight">
                  {property?.floor ?? '—'}
                </span>
                <span className="text-xs font-medium text-app_grey">
                  Floor
                </span>
              </div>
            </div>

            {/* Surface */}
            <div className="flex items-center gap-2">
              <FiMaximize2 className="w-4 h-4 text-app_blue" />
              <div className="flex flex-col">
                <span className="text-base font-bold text-app_blue leading-tight">
                  {property?.area || '—'} m²
                </span>
                <span className="text-xs font-medium text-app_grey">
                  Surface
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end justify-center">

            {/* Price + Labels in one row */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-800/25 text-green-900 whitespace-nowrap">
                  Paid: {Number(
                    paymentSchedule.reduce(
                      (sum, p) =>
                        sum +
                        (isScheduleRowPaid(p)
                          ? getSchedulePaidAmount(p) || getScheduleAmount(p)
                          : 0),
                      0
                    )
                  ).toLocaleString()} {rentalCurrency}
                </span>

                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-900 whitespace-nowrap">
                  Due: {Number(outstandingBalance).toLocaleString()} {rentalCurrency}
                </span>
              </div>
              <div>
                <div className="text-2xl font-bold text-app_blue whitespace-nowrap">
                  {Number(property?.price || 0).toLocaleString()} TND
                  <span className="text-sm text-app_yellow ml-1">/mo</span>
                </div>
                {strictAgencyFeeAmount > 0 && (
                  <div className="text-xs text-app_grey/90 mt-1 flex items-center gap-1">
                    <span className="text-xs font-semibold text-app_yellow">+</span>
                    <span>{Number(strictAgencyFeeAmount).toLocaleString()} TND</span>
                    <InfoTooltip className="text-xs" text="Agency Fee" />
                  </div>
                )}
              </div>


            </div>

            {/* Expiry badge stays below */}
            {expiryBadge && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${expiryBadge.cls}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {expiryBadge.label}
              </span>
            )}
          </div>
        </div>

        {/* Row 4: Section tabs */}
        <div className="pt-2">
          <div className="flex items-center gap-2">
            {sectionTabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => setTab(item.name)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition-all flex items-center gap-2 ${tab === item.name
                    ? 'bg-app_yellow text-app_blue shadow-sm'
                    : 'text-app_grey hover:bg-app_yellow/10 hover:text-app_blue'
                    }`}
                >
                  <Icon className="w-3 h-3" />
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* Content Area */}
      <div className="px-2 lg:px-2 pb-4  pt-1 space-y-5">
        {tab === 'Overview' && (
          <div className="space-y-4">
            {/* Rental Information - Compact with Property Image */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
              {/* Stakeholders - Compact in grid */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-lg border border-app_blue/10 p-4 shadow-sm">
                  <h3 className="font-bold text-app_blue text-sm mb-3 flex items-center gap-2">
                    <FiZap className="w-4 h-4 text-app_yellow" />
                    Rental Information
                  </h3>

                  {/* Stakeholders Grid - 3 columns */}
                  <div className="grid grid-cols-3 gap-2">
                    <PersonCard title="Owner" person={owner || property?.ownerId} />
                    <PersonCard title="Agent" person={agent || property?.createdBy || property?.agent_id} />
                    <PersonCard title="Tenant" person={tenant || rental?.tenantId} />
                  </div>
                </div>
              </div>

              {/* Property Photo - Right Column */}

            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg border border-app_blue/10 p-4 shadow-sm">
              <h3 className="font-bold text-app_blue text-sm mb-3">Quick Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Status</p>
                  <p className="text-sm font-bold text-app_blue">{rental?.status || 'N/A'} ✓</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Move-in</p>
                  <p className="text-sm font-bold text-app_blue">{formatDate(rental?.moveInDate || rental?.contractSignedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Move-out</p>
                  <p className="text-sm font-bold text-app_blue">
                    {formatDate(rental?.moveOutDate)}
                    {rental?.moveOutDate && (
                      <span className="text-xs text-app_grey block">
                        ({Math.max(0, Math.ceil((new Date(rental.moveOutDate) - new Date()) / (1000 * 60 * 60 * 24)))} days)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Monthly Rent</p>
                  <p className="text-sm font-bold text-app_blue">{Number(property?.price || rental?.amount || 0).toLocaleString()} TND</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Deposit</p>
                  <p className="text-sm font-bold text-app_blue">{Number(listing?.deposit || 0).toLocaleString()} TND</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Duration</p>
                  <p className="text-sm font-bold text-app_blue">{rental?.durationMonths || '-'} months</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Auto-Renew</p>
                  <p className="text-sm font-bold text-app_blue">{rental?.autoRenew ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Notice Period</p>
                  <p className="text-sm font-bold text-app_blue">{rental?.noticePeriodDays || 30} days</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Frequency</p>
                  <p className="text-sm font-bold text-app_blue">Every {rental?.paymentFrequencyMonths || 1} month(s)</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Next Payment Due</p>
                  <p className="text-sm font-bold text-app_blue">{formatDate(nextPaymentDueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Last Payment Date</p>
                  <p className="text-sm font-bold text-app_blue">{formatDate(lastPaymentDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-app_grey font-semibold uppercase mb-1">Outstanding Balance</p>
                  <p className="text-sm font-bold text-red-600">{Number(outstandingBalance).toLocaleString()} {rentalCurrency}</p>
                </div>
              </div>
            </div>

          

            {/* Contract Details */}
            <div className="bg-white rounded-lg border border-app_blue/10 p-4 shadow-sm">
              <h3 className="font-bold text-app_blue text-sm mb-3 flex items-center gap-2">
                <FiFileText className="w-4 h-4" />
                Contract Details
              </h3>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-app_yellow">✓</span>
                  <span className="text-app_grey font-semibold">Status:</span>
                  <span className="text-app_blue">Signed by all 3 parties</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FiFileText className="w-4 h-4 text-app_blue flex-shrink-0" />
                  <span className="text-app_grey font-semibold">Version:</span>
                  <span className="text-app_blue">{contracts.length} (Latest)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FiCalendar className="w-4 h-4 text-app_blue flex-shrink-0" />
                  <span className="text-app_grey font-semibold">Legal Expiry:</span>
                  <span className="text-app_blue text-xs">
                    {rental?.moveOutDate ? new Date(new Date(rental.moveOutDate).getTime() + (7 * 365.25 * 24 * 60 * 60 * 1000)).getFullYear() + '-01-05' : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <FiRefreshCw className="w-4 h-4 text-app_blue flex-shrink-0" />
                  <span className="text-app_grey font-semibold">Auto-Renew:</span>
                  <span className={`text-sm font-bold ${rental?.autoRenew ? 'text-green-700' : 'text-app_grey'}`}>{rental?.autoRenew ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>
          </div>
        )}


        {tab === 'Payments' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-4 shadow-sm">
                <p className="text-xs font-semibold text-app_grey uppercase">Monthly Amount</p>
                <p className="text-lg font-bold text-app_blue mt-1">{monthlyPaymentAmount.toLocaleString()} {rentalCurrency}</p>
              </div>
              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-4 shadow-sm">
                <p className="text-xs font-semibold text-app_grey uppercase">Last Payment Date</p>
                <p className="text-lg font-bold text-app_blue mt-1">{formatDate(lastPaymentDate)}</p>
              </div>
              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-4 shadow-sm">
                <p className="text-xs font-semibold text-app_grey uppercase">Next Due Date</p>
                <p className="text-lg font-bold text-app_blue mt-1">{formatDate(nextPaymentDueDate)}</p>
              </div>
              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-4 shadow-sm">
                <p className="text-xs font-semibold text-app_grey uppercase">Outstanding Balance</p>
                <p className="text-lg font-bold text-red-600 mt-1">{Number(outstandingBalance).toLocaleString()} {rentalCurrency}</p>
              </div>
              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-4 shadow-sm">
                <p className="text-xs font-semibold text-app_grey uppercase">Payment Frequency</p>
                <p className="text-lg font-bold text-app_blue mt-1">{rental?.paymentFrequencyMonths || 1} month(s)</p>
              </div>
            </div>

            {isStaffRentalUser && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-app_blue/10 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-app_grey uppercase">Total Income</p>
                  <p className="text-lg font-bold text-app_blue mt-1">{formatMoney(trackingTotals.totalPaid)} {rentalCurrency}</p>
                </div>
                <div className="bg-white rounded-2xl border border-app_blue/10 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-app_grey uppercase">Agency Amount</p>
                  <p className="text-lg font-bold text-app_blue mt-1">{formatMoney(trackingTotals.totalAgency)} {rentalCurrency}</p>
                </div>
                <div className="bg-white rounded-2xl border border-app_blue/10 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-app_grey uppercase">Deposit Collected</p>
                  <p className="text-lg font-bold text-app_blue mt-1">{formatMoney(trackingTotals.totalDeposit)} {rentalCurrency}</p>
                </div>
                <div className="bg-white rounded-2xl border border-app_blue/10 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-app_grey uppercase">Overdue Months</p>
                  <p className="text-lg font-bold text-red-600 mt-1">{trackingTotals.overdueMonths}</p>
                </div>
              </div>
            )}

            <div className="bg-app_blue/10 border border-app_blue/20 rounded-xl p-3 text-xs text-app_blue space-y-1">
              <p className="font-semibold">Backend-aligned payment tracking</p>
              <p>Monthly status, paid/due totals, tranche lines, and invoice links are rendered from backend tracking data.</p>
            </div>

            {!!stalePendingPayments.length && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                {stalePendingPayments.length} pending payment request(s) are older than 7 days and may still be awaiting accountant verification.
              </div>
            )}

            {paymentActionError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{paymentActionError}</p>
            )}
            {paymentActionNotice && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">{paymentActionNotice}</p>
            )}

            <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-app_blue text-lg">Monthly Payment Timeline</h3>
                <span className="text-xs text-app_grey">Rows are clickable for full payment + invoice details</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-app_blue/10 bg-app_blue/5 p-3">
                  <p className="text-[10px] uppercase text-app_grey">Tracked Paid</p>
                  <p className="text-sm font-bold text-app_blue">{formatMoney(trackingTotals.totalPaid)} {rentalCurrency}</p>
                </div>
                <div className="rounded-xl border border-app_blue/10 bg-emerald-50 p-3">
                  <p className="text-[10px] uppercase text-app_grey">Tracked Due</p>
                  <p className="text-sm font-bold text-emerald-700">{formatMoney(trackingTotals.totalDue)} {rentalCurrency}</p>
                </div>
                <div className="rounded-xl border border-app_blue/10 bg-amber-50 p-3">
                  <p className="text-[10px] uppercase text-app_grey">Tracked Balance</p>
                  <p className="text-sm font-bold text-amber-700">{formatMoney(Math.max(trackingTotals.totalDue - trackingTotals.totalPaid, 0))} {rentalCurrency}</p>
                </div>
                <div className="rounded-xl border border-app_blue/10 bg-white p-3">
                  <p className="text-[10px] uppercase text-app_grey">Last Tracked Payment</p>
                  <p className="text-sm font-bold text-app_blue">{formatDate(lastTrackedPaymentDate || lastPaymentDate)}</p>
                </div>
              </div>

              {!paymentTrackingRows.length ? (
                <p className="text-sm text-app_grey">No monthly tracking data available yet for this rental.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-app_lightGrey">
                  <table className="w-full min-w-300 text-sm">
                    <thead className="bg-app_blue text-white">
                      <tr>
                        <th className="text-left px-3 py-2">Month</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th className="text-left px-3 py-2">Due</th>
                        <th className="text-left px-3 py-2">Paid</th>
                        <th className="text-left px-3 py-2">Balance</th>
                        <th className="text-left px-3 py-2">Tranches</th>
                        <th className="text-left px-3 py-2">Invoices</th>
                        <th className="text-left px-3 py-2">Last Payment</th>
                        <th className="text-left px-3 py-2">Agency</th>
                        <th className="text-left px-3 py-2">Deposit</th>
                        <th className="text-left px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentTrackingRows.map((month) => {
                        const monthStatusMeta = getTrackingMonthStatusMeta(month?.status);
                        return (
                          <tr
                            key={month.rowKey}
                            className="border-t border-app_lightGrey/70 hover:bg-app_yellow/10 cursor-pointer"
                            onClick={() => setTrackingMonthDetail(month)}
                          >
                            <td className="px-3 py-2 text-app_blue font-semibold">{getTrackingMonthLabel(month?.periodStart, month?.periodEnd)}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${monthStatusMeta.cls}`}>
                                {monthStatusMeta.label}
                              </span>
                            </td>
                            <td className="px-3 py-2">{formatMoney(month.dueAmount)} {rentalCurrency}</td>
                            <td className="px-3 py-2">{formatMoney(month.paidAmount)} {rentalCurrency}</td>
                            <td className="px-3 py-2 font-semibold text-red-600">{formatMoney(month.balanceAmount)} {rentalCurrency}</td>
                            <td className="px-3 py-2">{month.tranches.length}</td>
                            <td className="px-3 py-2">{month.invoices.length}</td>
                            <td className="px-3 py-2">{formatDate(month.lastPaymentAt)}</td>
                            <td className="px-3 py-2">{formatMoney(month.agencyAmount)}</td>
                            <td className="px-3 py-2">{formatMoney(month.depositAmount)}</td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setTrackingMonthDetail(month);
                                }}
                                className="px-2 py-1 rounded-lg border border-app_blue text-app_blue text-xs font-semibold hover:bg-app_blue hover:text-white transition-all"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-app_grey bg-app_yellow/10 border border-app_yellow/40 rounded-lg px-2 py-1">
                First-month logic remains backend-driven: first month due may include agency fee + deposit, then standard rent applies next months.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-app_blue text-base flex items-center gap-1">
                    Stripe Payment Actions
                    <InfoTooltip text="Create a Stripe payment intent first, then confirm payment by card. Final status is updated by backend webhook." />
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${hasStripeKey ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {hasStripeKey ? 'Stripe Ready' : 'Stripe Key Missing'}
                  </span>
                </div>

                {!canInitiatePayments && (
                  <p className="text-xs text-app_grey bg-app_yellow/15 rounded-lg p-2">
                    Payment actions are enabled for tenant account only. Owner and agent can monitor statuses and proofs here.
                  </p>
                )}

                {!hasStripeKey && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    Stripe is unavailable in this frontend environment. Use offline cash/cheque flow until VITE_STRIPE_PUBLISHABLE_KEY is configured.
                  </p>
                )}

                <div className="border border-app_lightGrey rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-app_blue uppercase flex items-center gap-1">
                    Single Period Intent
                    <InfoTooltip text="Tenant amount is mandatory and must match rent + agency fee (+ deposit on first payment month)." />
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      value={stripeDraft.amount}
                      onChange={(e) => setStripeDraft((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="Amount (required)"
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeSingle}
                    />
                    <input
                      value={stripeDraft.currency}
                      onChange={(e) => setStripeDraft((prev) => ({ ...prev, currency: e.target.value.toLowerCase() }))}
                      placeholder="Currency (tnd)"
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeSingle}
                    />
                    <input
                      type="date"
                      value={stripeDraft.billingPeriodStart}
                      onChange={(e) => setStripeDraft((prev) => ({ ...prev, billingPeriodStart: e.target.value }))}
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeSingle}
                    />
                    <input
                      type="date"
                      value={stripeDraft.billingPeriodEnd}
                      onChange={(e) => setStripeDraft((prev) => ({ ...prev, billingPeriodEnd: e.target.value }))}
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeSingle}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={createStripeSingleIntent}
                    disabled={!canInitiatePayments || paymentActionBusy.stripeSingle}
                    className="px-3 py-2 rounded-lg bg-app_blue text-white text-xs font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60"
                  >
                    {paymentActionBusy.stripeSingle ? 'Creating...' : 'Create Stripe Intent'}
                  </button>
                </div>

                <div className="border border-app_lightGrey rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-app_blue uppercase flex items-center gap-1">
                    Bulk Upfront Intent
                    <InfoTooltip text="Create one intent covering multiple months based on backend billing logic." />
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="2"
                      value={bulkDraft.monthsCount}
                      onChange={(e) => setBulkDraft((prev) => ({ ...prev, monthsCount: e.target.value }))}
                      placeholder="Months count (>=2)"
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeBulk}
                    />
                    <input
                      type="date"
                      value={bulkDraft.startFromMonth}
                      onChange={(e) => setBulkDraft((prev) => ({ ...prev, startFromMonth: e.target.value }))}
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeBulk}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={createStripeBulkIntent}
                    disabled={!canInitiatePayments || paymentActionBusy.stripeBulk}
                    className="px-3 py-2 rounded-lg bg-app_blue text-white text-xs font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60"
                  >
                    {paymentActionBusy.stripeBulk ? 'Creating...' : 'Create Bulk Intent'}
                  </button>
                </div>

                <div className="border border-app_lightGrey rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-app_blue uppercase flex items-center gap-1">
                    Tranche Intent
                    <InfoTooltip text="Create partial payment tranches according to backend validation rules." />
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={trancheDraft.trancheAmount}
                      onChange={(e) => setTrancheDraft((prev) => ({ ...prev, trancheAmount: e.target.value }))}
                      placeholder="Tranche amount"
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeTranche}
                    />
                    <input
                      type="number"
                      min="1"
                      value={trancheDraft.trancheNumber}
                      onChange={(e) => setTrancheDraft((prev) => ({ ...prev, trancheNumber: e.target.value }))}
                      placeholder="Tranche #"
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeTranche}
                    />
                    <input
                      type="date"
                      value={trancheDraft.forMonth}
                      onChange={(e) => setTrancheDraft((prev) => ({ ...prev, forMonth: e.target.value }))}
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.stripeTranche}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={createStripeTrancheIntent}
                    disabled={!canInitiatePayments || paymentActionBusy.stripeTranche}
                    className="px-3 py-2 rounded-lg bg-app_blue text-white text-xs font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60"
                  >
                    {paymentActionBusy.stripeTranche ? 'Creating...' : 'Create Tranche Intent'}
                  </button>
                </div>

                {stripeIntentState.clientSecret && (
                  <div className="border border-app_lightGrey rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-app_blue uppercase flex items-center gap-1">
                      Confirm Card Payment
                      <InfoTooltip text="Use this form to confirm card payment for the currently created intent." />
                    </p>
                    <p className="text-xs text-app_grey">Intent mode: <span className="font-semibold text-app_blue uppercase">{stripeIntentState.mode || '-'}</span></p>
                    <p className="text-xs text-app_grey">Payment ID: {stripeIntentState.paymentId || '-'}</p>

                    {!hasStripeKey && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        Intent created, but Stripe card form cannot render without publishable key.
                      </p>
                    )}

                    {hasStripeKey && stripePromise && (
                      <Elements stripe={stripePromise}>
                        <StripeCardCheckoutForm
                          clientSecret={stripeIntentState.clientSecret}
                          disabled={!canInitiatePayments}
                          onConfirm={handleStripePaymentConfirmed}
                          onError={(message) => setPaymentActionError(message)}
                          onProcessingChange={(value) => setPaymentActionBusy((prev) => ({ ...prev, stripeConfirm: value }))}
                        />
                      </Elements>
                    )}

                    <button
                      type="button"
                      onClick={resetStripeIntentState}
                      className="px-3 py-1.5 rounded-lg border border-app_blue text-app_blue text-xs font-semibold hover:bg-app_blue hover:text-white transition-all"
                    >
                      Clear Current Intent
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-4 shadow-sm space-y-4">
                <h3 className="font-bold text-app_blue text-base">Offline Payment Request (Cash / Cheque)</h3>

                <p className="text-xs text-app_grey bg-app_yellow/15 rounded-lg p-2">
                  Bank transfer is not currently a backend enum. Temporary workaround: submit as cash and include transfer details in payment note. TODO(BE): add transfer enum.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={offlineDraft.amount}
                    onChange={(e) => setOfflineDraft((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="Amount"
                    className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                    disabled={!canInitiatePayments || paymentActionBusy.offline}
                  />
                  <input
                    value={offlineDraft.currency}
                    onChange={(e) => setOfflineDraft((prev) => ({ ...prev, currency: e.target.value.toLowerCase() }))}
                    placeholder="Currency"
                    className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                    disabled={!canInitiatePayments || paymentActionBusy.offline}
                  />
                  <select
                    value={offlineDraft.paymentMethod}
                    onChange={(e) => setOfflineDraft((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                    className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                    disabled={!canInitiatePayments || paymentActionBusy.offline}
                  >
                    <option value={PAYMENT_METHODS.CASH}>cash</option>
                    <option value={PAYMENT_METHODS.CHEQUE}>cheque</option>
                  </select>
                  <input
                    value={offlineDraft.bankName}
                    onChange={(e) => setOfflineDraft((prev) => ({ ...prev, bankName: e.target.value }))}
                    placeholder="Bank Name (optional)"
                    className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                    disabled={!canInitiatePayments || paymentActionBusy.offline}
                  />
                  <input
                    type="date"
                    value={offlineDraft.billingPeriodStart}
                    onChange={(e) => setOfflineDraft((prev) => ({ ...prev, billingPeriodStart: e.target.value }))}
                    className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                    disabled={!canInitiatePayments || paymentActionBusy.offline}
                  />
                  <input
                    type="date"
                    value={offlineDraft.billingPeriodEnd}
                    onChange={(e) => setOfflineDraft((prev) => ({ ...prev, billingPeriodEnd: e.target.value }))}
                    className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                    disabled={!canInitiatePayments || paymentActionBusy.offline}
                  />
                </div>

                {offlineDraft.paymentMethod === PAYMENT_METHODS.CHEQUE && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      value={offlineDraft.chequeNumber}
                      onChange={(e) => setOfflineDraft((prev) => ({ ...prev, chequeNumber: e.target.value }))}
                      placeholder="Cheque Number (required)"
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.offline}
                    />
                    <input
                      type="date"
                      value={offlineDraft.chequeDate}
                      onChange={(e) => setOfflineDraft((prev) => ({ ...prev, chequeDate: e.target.value }))}
                      className="border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      disabled={!canInitiatePayments || paymentActionBusy.offline}
                    />
                  </div>
                )}

                <textarea
                  value={offlineDraft.paymentMethodNote}
                  onChange={(e) => setOfflineDraft((prev) => ({ ...prev, paymentMethodNote: e.target.value }))}
                  className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm min-h-20 focus:border-app_blue focus:outline-none"
                  placeholder="Payment note (optional): cashier name, transfer reference, verification context..."
                  disabled={!canInitiatePayments || paymentActionBusy.offline}
                />

                <div className="border border-app_lightGrey rounded-lg p-3 space-y-2">
                  <label className="text-xs font-semibold text-app_grey uppercase block">Payment Proof Upload</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setOfflineProofFile(e.target.files?.[0] || null)}
                    className="w-full border border-app_lightGrey rounded-lg px-2 py-1 text-xs"
                    disabled={!canInitiatePayments || paymentActionBusy.uploadProof || paymentActionBusy.offline}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => uploadOfflineProof()}
                      disabled={!canInitiatePayments || !offlineProofFile || paymentActionBusy.uploadProof || paymentActionBusy.offline}
                      className="px-3 py-1.5 rounded-lg border border-app_blue text-app_blue text-xs font-semibold hover:bg-app_blue hover:text-white transition-all disabled:opacity-60"
                    >
                      {paymentActionBusy.uploadProof ? 'Uploading...' : 'Upload Proof'}
                    </button>
                    {offlineDraft.paymentProofUrl && (
                      <a
                        href={offlineDraft.paymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-app_lightGrey text-app_blue text-xs font-semibold hover:bg-app_yellow/20"
                      >
                        Open Proof URL
                      </a>
                    )}
                  </div>
                  {offlineProofMeta.fileName && (
                    <p className="text-xs text-green-700">Uploaded: {offlineProofMeta.fileName}</p>
                  )}
                  <label className="inline-flex items-center gap-2 text-xs text-app_grey">
                    <input
                      type="checkbox"
                      checked={saveProofAsReceiptDoc}
                      onChange={(e) => setSaveProofAsReceiptDoc(e.target.checked)}
                      disabled={!canInitiatePayments || paymentActionBusy.offline}
                    />
                    Also store proof as rental document (receipt)
                  </label>
                </div>

                <button
                  type="button"
                  onClick={submitOfflinePaymentRequest}
                  disabled={!canInitiatePayments || paymentActionBusy.offline}
                  className="px-4 py-2 rounded-lg bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60"
                >
                  {paymentActionBusy.offline ? 'Submitting...' : 'Submit Offline Payment'}
                </button>
              </div>
            </div>

            {!!trackingMonthDetail && (
              <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
                <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-app_lightGrey shadow-xl">
                  <div className="px-4 py-3 bg-app_blue text-white flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold">Monthly Payment Details</h3>
                      <p className="text-xs text-white/80">{getTrackingMonthLabel(trackingMonthDetail?.periodStart, trackingMonthDetail?.periodEnd)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTrackingMonthDetail(null)}
                      className="px-2 py-1 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold"
                    >
                      Close
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="rounded-lg border border-app_lightGrey p-2">
                        <p className="text-[10px] uppercase text-app_grey">Status</p>
                        <p className="text-sm font-semibold text-app_blue">{getTrackingMonthStatusMeta(trackingMonthDetail?.status).label}</p>
                      </div>
                      <div className="rounded-lg border border-app_lightGrey p-2">
                        <p className="text-[10px] uppercase text-app_grey">Total Due</p>
                        <p className="text-sm font-semibold text-app_blue">{formatMoney(trackingMonthDetail?.dueAmount)} {rentalCurrency}</p>
                      </div>
                      <div className="rounded-lg border border-app_lightGrey p-2">
                        <p className="text-[10px] uppercase text-app_grey">Total Paid</p>
                        <p className="text-sm font-semibold text-app_blue">{formatMoney(trackingMonthDetail?.paidAmount)} {rentalCurrency}</p>
                      </div>
                      <div className="rounded-lg border border-app_lightGrey p-2">
                        <p className="text-[10px] uppercase text-app_grey">Last Payment</p>
                        <p className="text-sm font-semibold text-app_blue">{formatDate(trackingMonthDetail?.lastPaymentAt)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-app_grey uppercase">Tranches</p>
                      {!trackingMonthDetail?.tranches?.length ? (
                        <p className="text-xs text-app_grey">No tranche lines recorded for this month.</p>
                      ) : (
                        <div className="space-y-2">
                          {trackingMonthDetail.tranches.map((line, lineIndex) => {
                            const lineStatusMeta = getPaymentStatusMeta(line?.status);
                            return (
                              <div key={`${line?.paymentId || 'line'}-${line?.trancheNumber || lineIndex}`} className="rounded-lg border border-app_lightGrey/70 px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-app_blue">Tranche {line?.trancheNumber || lineIndex + 1}</span>
                                  <span className="text-app_grey">Amount: {formatMoney(line?.amount)} {rentalCurrency}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lineStatusMeta.cls}`}>{lineStatusMeta.label}</span>
                                  <span className="text-app_grey">{formatDate(line?.paidAt)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-app_grey uppercase">Linked Invoices</p>
                      {!trackingMonthDetail?.invoices?.length ? (
                        <p className="text-xs text-app_grey">No invoice linked for this month yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {trackingMonthDetail.invoices.map((entry, invoiceIndex) => {
                            const invoice = entry?.invoice || {};
                            const invoiceBreakdown = invoice?.paymentBreakdown || {};
                            return (
                              <div key={`${entry?.paymentId || 'invoice'}-${invoice?._id || invoiceIndex}`} className="rounded-lg border border-app_lightGrey/70 px-3 py-2 text-xs space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-app_blue">{invoice?.invoiceNumber || 'Invoice'}</span>
                                  <span className="text-app_grey">Total: {formatMoney(invoice?.total)} {rentalCurrency}</span>
                                </div>
                                <p className="text-app_grey">Billing: {getTrackingMonthLabel(invoice?.billingPeriodStart || trackingMonthDetail?.periodStart, invoice?.billingPeriodEnd || trackingMonthDetail?.periodEnd)}</p>
                                <p className="text-app_grey">Breakdown: rent {formatMoney(invoiceBreakdown?.rentAmount)} | agency {formatMoney(invoiceBreakdown?.agencyFeeAmount)} | deposit {formatMoney(invoiceBreakdown?.depositAmount)}</p>
                                <div className="flex flex-wrap items-center gap-2">
                                  {invoice?.pdfUrl ? (
                                    <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex px-2 py-1 rounded-lg bg-app_blue/10 text-app_blue font-semibold">
                                      View PDF
                                    </a>
                                  ) : (
                                    <span className="inline-flex px-2 py-1 rounded-lg bg-amber-100 text-amber-700 font-semibold">
                                      PDF generating
                                    </span>
                                  )}
                                </div>
                                {invoice?.signatureUrl ? (
                                  <a href={invoice.signatureUrl} target="_blank" rel="noopener noreferrer" className="inline-flex px-2 py-1 rounded-lg bg-app_blue/10 text-app_blue font-semibold">
                                    Open signature
                                  </a>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'Documents' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-md space-y-4">
                <h3 className="font-bold text-app_blue text-lg flex items-center gap-2">
                  <FiFileText className="w-5 h-5" />
                  Contract
                </h3>

                {latestContract && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-app_lightGrey">
                      <div className="flex items-center gap-2">
                        <FiFileText className="w-4 h-4 text-app_blue" />
                        <a
                          href={latestContract.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-app_blue hover:text-app_yellow transition-colors underline"
                        >
                          {latestContract.fileName || 'Contract.pdf'}
                        </a>
                      </div>
                      <span className="text-xs font-semibold text-app_grey bg-app_yellow/20 px-2 py-1 rounded">Latest</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => downloadContractHandler(latestContract._id)}
                        disabled={docsBusy}
                        className="px-3 py-2 rounded-lg bg-app_blue text-white text-xs font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60 shadow-md"
                      >
                        Download
                      </button>
                      {canManageRentalContracts && (
                        <>
                          <button
                            onClick={() => archiveContractHandler(latestContract._id)}
                            disabled={docsBusy}
                            className="px-3 py-2 rounded-lg border-2 border-red-500 text-red-600 text-xs font-semibold hover:bg-red-500 hover:text-white transition-all disabled:opacity-60"
                          >
                            Archive
                          </button>
                          <button
                            onClick={openManualContractWorkflow}
                            disabled={docsBusy}
                            className="px-3 py-2 rounded-lg bg-app_blue text-white text-xs font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60 shadow-md"
                          >
                            Renew Contract
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {!latestContract && (
                  <>
                    {canManageRentalContracts ? (
                      <button
                        onClick={openManualContractWorkflow}
                        disabled={docsBusy}
                        className="w-full px-4 py-3 rounded-lg bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60 shadow-md"
                      >
                        Add Contract
                      </button>
                    ) : (
                      <p className="text-xs text-app_grey bg-app_yellow/10 px-3 py-2 rounded-lg">
                        Contracts are view-only for owner/tenant. Only staff can add or renew contracts.
                      </p>
                    )}
                  </>
                )}

                {!!contracts.length && (
                  <div className="space-y-2 pt-3 border-t border-app_lightGrey">
                    <p className="text-xs font-semibold text-app_grey uppercase">All Versions</p>
                    <div className="space-y-2">
                      {contracts.map((contract) => (
                        <div key={contract._id} className="border-2 border-app_lightGrey rounded-lg p-2.5 text-sm hover:border-app_yellow/50 transition-all">
                          <p className="font-semibold text-app_blue">Version {contract.versionNumber || '-'}</p>
                          <p className="text-xs text-app_grey">Status: {contract.status || '-'} | Created: {formatDate(contract.createdAt)}</p>
                          <div className="pt-1">
                            <button
                              onClick={() => downloadContractHandler(contract._id)}
                              disabled={docsBusy}
                              className="px-2.5 py-1 rounded-lg border-2 border-app_blue text-app_blue text-xs font-semibold hover:bg-app_blue hover:text-white transition-all disabled:opacity-60"
                            >
                              Download Version
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-md space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-app_blue text-lg">Documents</h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={documentTypeFilter}
                      onChange={async (e) => {
                        const next = e.target.value;
                        setDocumentTypeFilter(next);
                        await refreshDocumentsData(getRentalId(rental), next);
                      }}
                      className="border-2 border-app_lightGrey rounded-lg px-2 py-1.5 text-xs focus:border-app_blue focus:outline-none"
                    >
                      <option value="">All Types</option>
                      <optgroup label="Core Documents">
                        <option value="contract">Contract</option>
                        <option value="inventory">Inventory / Move-in/out Checklist</option>
                        <option value="insurance">Insurance Documents</option>
                        <option value="inspection">Inspection Report</option>
                        <option value="receipt">Payment Receipt</option>
                        <option value="invoice">Invoice</option>
                        <option value="utility">Utility Bill / Proof of Payment</option>
                      </optgroup>
                      <optgroup label="Identity &amp; Legal">
                        <option value="cin">National ID (CIN)</option>
                        <option value="passport">Passport</option>
                        <option value="residence_permit">Residence Permit</option>
                        <option value="driver_license">Driver's License</option>
                      </optgroup>
                      <optgroup label="Financial &amp; Banking">
                        <option value="bank_statement">Bank Statement</option>
                        <option value="payslip">Payslip / Proof of Income</option>
                        <option value="tax_return">Tax Return</option>
                        <option value="guarantor_proof">Guarantor Income/ID Proof</option>
                        <option value="deposit_proof">Security Deposit Proof</option>
                        <option value="standing_order">Standing Order / Auto Payment</option>
                      </optgroup>
                      <optgroup label="Property Legal">
                        <option value="property_title">Property Title / Proof of Ownership</option>
                        <option value="land_registry">Land Registry Extract</option>
                        <option value="co_ownership_rules">Co-ownership / Building Rules</option>
                      </optgroup>
                      <optgroup label="Tenant History">
                        <option value="previous_contract">Previous Rental Contract</option>
                        <option value="landlord_reference">Landlord Reference</option>
                        <option value="employment_contract">Employment Contract</option>
                      </optgroup>
                      <optgroup label="Compliance &amp; Safety">
                        <option value="epc">Energy Performance Certificate</option>
                        <option value="gas_safety">Gas Safety Certificate</option>
                        <option value="electrical_safety">Electrical Safety Certificate</option>
                        <option value="asbestos_report">Asbestos Report</option>
                        <option value="lead_report">Lead Paint Report</option>
                      </optgroup>
                      <option value="other">Other</option>
                    </select>
                    <button
                      onClick={() => {
                        if (!canUploadDocuments) {
                          setDocsError('You are not allowed to upload documents for this rental.');
                          return;
                        }
                        setShowUploadDocumentModal(true);
                      }}
                      disabled={docsBusy || !canUploadDocuments}
                      className="px-4 py-1.5 rounded-lg bg-app_blue text-white text-xs font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60 shadow-md whitespace-nowrap"
                    >
                      + Add Document
                    </button>
                  </div>
                </div>

                {docsLoading && <p className="text-sm text-app_grey">Loading documents...</p>}

                {!docsLoading && !documents.length && (
                  <p className="text-sm text-app_grey">No documents found for this rental and filter.</p>
                )}

                {!!documents.length && (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {documents.map((doc) => (
                      <div key={doc._id} className="border-2 border-app_lightGrey rounded-lg p-3 text-sm hover:border-app_yellow/50 transition-all">
                        <p className="font-semibold text-app_blue">{doc.title || '-'}</p>
                        <p className="text-xs text-app_grey mt-1">Type: {doc.documentType || '-'} | Uploaded: {formatDate(doc.uploadedAt)}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            onClick={() => downloadDocumentHandler(doc._id)}
                            disabled={docsBusy}
                            className="px-2.5 py-1 rounded-lg bg-app_blue text-white text-xs font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60"
                          >
                            Download
                          </button>
                          {canDeleteDocuments && (
                            <button
                              onClick={() => deleteDocumentHandler(doc._id)}
                              disabled={docsBusy}
                              className="px-2.5 py-1 rounded-lg border-2 border-red-500 text-red-600 text-xs font-semibold hover:bg-red-500 hover:text-white transition-all disabled:opacity-60"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'Performance' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-md hover:shadow-lg transition-all">
              <p className="text-xs font-semibold text-app_grey flex items-center gap-1 mb-2">
                Total Income
                <InfoIcon text="Total amount expected to be paid for this rental" />
              </p>
              <p className="text-lg font-bold text-app_blue">{totalIncome.toLocaleString()} TND</p>
            </div>
            <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-md hover:shadow-lg transition-all">
              <p className="text-xs font-semibold text-app_grey mb-2">ROI</p>
              <p className="text-lg font-bold text-app_blue">N/A</p>
            </div>
            <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-md hover:shadow-lg transition-all">
              <p className="text-xs font-semibold text-app_grey mb-2">Tenant Satisfaction</p>
              <p className="text-lg font-bold text-app_blue">N/A</p>
            </div>
          </div>
        )}



        {tab === 'Renewal / Exit' && (
          <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-md space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <FiRefreshCw className="w-5 h-5 text-app_blue" />
              <h2 className="font-bold text-app_blue text-lg">Renewal / Exit Planning</h2>
            </div>
            <p className="text-sm text-app_grey">Contract end: <span className="text-app_blue font-semibold">{formatDate(rental?.moveOutDate)}</span></p>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!canManageCriticalRentalActions}
                className="px-4 py-2 rounded-lg bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all shadow-md disabled:opacity-60"
              >
                Renew
              </button>
              <button
                disabled={!canManageCriticalRentalActions}
                className="px-4 py-2 rounded-lg border-2 border-app_blue text-app_blue text-sm font-semibold hover:bg-app_blue hover:text-white transition-all disabled:opacity-60"
              >
                Modify Terms
              </button>
              <button
                disabled={!canManageCriticalRentalActions}
                className="px-4 py-2 rounded-lg border-2 border-red-500 text-red-600 text-sm font-semibold hover:bg-red-500 hover:text-white transition-all disabled:opacity-60"
              >
                End Contract
              </button>
            </div>
            {!canManageCriticalRentalActions && (
              <p className="text-xs text-app_grey bg-app_yellow/10 p-3 rounded-lg">
                Renewal and contract lifecycle changes are restricted to staff accounts.
              </p>
            )}
            <p className="text-xs text-app_grey bg-app_yellow/10 p-3 rounded-lg">Move-out checklist: key return, utility settlement, final inspection, deposit release.</p>
          </div>
        )}

        {tab === 'Tenant Profile' && (
          <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-md space-y-2 text-sm">
            <div className="flex items-center gap-2 mb-3">

              <FiUserCheck className="w-5 h-5 text-app_blue" />
              <h2 className="font-bold text-app_blue text-lg">Tenant Profile</h2>
            </div>
            <p><span className="font-semibold text-app_grey">Full name:</span> <span className="text-app_blue">{tenant?.firstName || tenant?.name || '-'} {tenant?.lastName || ''}</span></p>
            <p><span className="font-semibold text-app_grey">Email:</span> <span className="text-app_blue">{tenant?.email || '-'}</span></p>
            <p><span className="font-semibold text-app_grey">Phone:</span> <span className="text-app_blue">{tenant?.phone || '-'}</span></p>
            <p><span className="font-semibold text-app_grey">Emergency contact:</span> <span className="text-app_blue">{tenant?.emergencyContact || '-'}</span></p>
            <p><span className="font-semibold text-app_grey">Payment reliability:</span> <span className="text-app_blue font-bold">{onTimeRate}%</span></p>
            <p><span className="font-semibold text-app_grey">Notes / rating:</span> <span className="text-app_blue">N/A</span></p>
          </div>
        )}

        {tab === 'Quick Actions' && (
          <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-5 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <FiZap className="w-5 h-5 text-app_yellow" />
              <h2 className="font-bold text-app_blue text-lg">Quick Actions</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTab('Chat')} className="px-4 py-2 rounded-lg bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all shadow-md flex items-center gap-2">
                <FiMessageSquare className="w-4 h-4" />
                Open Chat
              </button>
              <button onClick={() => setTab('Payments')} className="px-4 py-2 rounded-lg border-2 border-app_blue text-app_blue text-sm font-semibold hover:bg-app_blue hover:text-white transition-all flex items-center gap-2">
                <FiDollarSign className="w-4 h-4" />
                Record Payment
              </button>
              <button onClick={() => setTab('Documents')} className="px-4 py-2 rounded-lg border-2 border-app_blue text-app_blue text-sm font-semibold hover:bg-app_blue hover:text-white transition-all flex items-center gap-2">
                <FiFileText className="w-4 h-4" />
                View Contract
              </button>
              <button onClick={() => setTab('Renewal / Exit')} className="px-4 py-2 rounded-lg border-2 border-app_blue text-app_blue text-sm font-semibold hover:bg-app_blue hover:text-white transition-all flex items-center gap-2">
                <FiRefreshCw className="w-4 h-4" />
                {canManageCriticalRentalActions ? 'Renew Contract' : 'Renew Contract (Staff Only)'}
              </button>
            </div>
          </div>
        )}

        {showManualContractModal && canManageRentalContracts && (


          // Your modal component (add this JSX where the modal is rendered)
          <div className="fixed inset-0 z-50 bg-black/40 px-3 py-6 overflow-y-auto">
            <div className="max-w-5xl mx-auto bg-white rounded-2xl border-2 border-app_blue/10 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-app_blue rounded-t-2xl">
                <div>
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-white uppercase mb-1">Property Contract</p>
                    <h1 className="text-2xl font-bold text-app_yellow">
                      {property?.title || property?.address || rental?.propertyAddress || 'Property Contract'}
                    </h1>
                  </div>
                  <h3 className="text-base font-bold text-white">Create Manual Contract</h3>

                </div>
                <button
                  onClick={() => setShowManualContractModal(false)}
                  className="px-4 py-2 rounded-4xl bg-app_whiteCustom text-app_blue text-xs font-bold hover:bg-app_yellow hover:text-app_blue transition-all"
                >
                  Close
                </button>
              </div>

              <div className="p-5 space-y-4">
                <section className="space-y-2">
                  <h4 className="text-sm font-bold text-app_blue flex items-center gap-1">
                    Rental Agreement Information
                    <InfoTooltip text="Pre-filled data from the rental agreement, property details, and active listing" />
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Property Reference
                        <InfoTooltip text="Unique identifier for the property" />
                      </label>
                      <input
                        value={manualDraft.propertyReference}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, propertyReference: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter property reference"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Tenant Full Name
                        <InfoTooltip text="Legal name of the tenant as it will appear on the contract" />
                      </label>
                      <input
                        value={manualDraft.tenantName}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, tenantName: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter tenant name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Tenant Email Address
                        <InfoTooltip text="Email address for contract delivery and communications" />
                      </label>
                      <input
                        value={manualDraft.tenantEmail}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, tenantEmail: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter tenant email"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Property Owner Name
                        <InfoTooltip text="Legal name of the property owner" />
                      </label>
                      <input
                        value={manualDraft.ownerName}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, ownerName: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter owner name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Owner Email Address
                        <InfoTooltip text="Email address for owner communications" />
                      </label>
                      <input
                        value={manualDraft.ownerEmail}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, ownerEmail: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter owner email"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Complete Property Address
                        <InfoTooltip text="Full street address including city and postal code" />
                      </label>
                      <input
                        value={manualDraft.propertyAddress}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, propertyAddress: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter complete property address"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Lease Start Date
                        <InfoTooltip text="Date when the tenant takes possession of the property" />
                      </label>
                      <input
                        type="date"
                        value={manualDraft.moveInDate}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, moveInDate: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Lease End Date
                        <InfoTooltip text="Expected date when the lease term concludes" />
                      </label>
                      <input
                        type="date"
                        value={manualDraft.moveOutDate}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, moveOutDate: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Lease Duration (Months)
                        <InfoTooltip text="Total length of the rental agreement in months" />
                      </label>
                      <input
                        value={manualDraft.durationMonths}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, durationMonths: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter duration in months"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Monthly Rent Amount
                        <InfoTooltip text="Total monthly rent charge" />
                      </label>
                      <input
                        value={manualDraft.rentAmount}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, rentAmount: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter rent amount"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Payment Amount Per Period
                        <InfoTooltip text="Amount to be paid each payment cycle" />
                      </label>
                      <input
                        value={manualDraft.paymentAmount}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, paymentAmount: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter payment amount"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Payment Frequency (Months)
                        <InfoTooltip text="How often rent is paid (1=monthly, 3=quarterly, etc.)" />
                      </label>
                      <input
                        value={manualDraft.paymentFrequency}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, paymentFrequency: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter payment frequency"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Automatic Renewal Status
                        <InfoTooltip text="Whether the lease automatically renews at the end of the term" />
                      </label>
                      <select
                        value={manualDraft.autoRenew}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, autoRenew: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                      >
                        <option value="Yes">Auto Renewal: Yes</option>
                        <option value="No">Auto Renewal: No</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="space-y-2 border-t border-app_lightGrey/60 pt-4">
                  <h4 className="text-sm font-bold text-app_blue flex items-center gap-1">
                    Financial Terms & Conditions
                    <InfoTooltip text="Detailed financial obligations and fee structure" />
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Security Deposit Amount
                        <InfoTooltip text="Refundable deposit held for damages or unpaid rent" />
                      </label>
                      <input
                        value={manualDraft.depositAmount}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, depositAmount: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter deposit amount"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Agency Service Fees
                        <InfoTooltip text="Fees charged by the property management agency" />
                      </label>
                      <input
                        value={manualDraft.agencyFees}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, agencyFees: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter agency fees"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Common Area Charges
                        <InfoTooltip text="Monthly fees for shared facilities and building maintenance" />
                      </label>
                      <input
                        value={manualDraft.commonCharges}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, commonCharges: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter common charges"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Utilities Included
                        <InfoTooltip text="Whether utilities are included in the rent (Yes/No)" />
                      </label>
                      <input
                        value={manualDraft.billsIncluded}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, billsIncluded: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Yes or No"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Utilities Details & Breakdown
                        <InfoTooltip text="Specify which utilities are included and payment responsibility" />
                      </label>
                      <textarea
                        value={manualDraft.billsDetails}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, billsDetails: e.target.value }))}
                        className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm min-h-16 focus:border-app_blue focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Describe utility arrangements and responsibilities"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Late Payment Penalty Rules
                        <InfoTooltip text="Fees or penalties for late rent payments" />
                      </label>
                      <input
                        value={manualDraft.lateFeeRules}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, lateFeeRules: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter late fee rules"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Maintenance Responsibility
                        <InfoTooltip text="Who is responsible for property maintenance and repairs" />
                      </label>
                      <input
                        value={manualDraft.maintenanceResponsibility}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, maintenanceResponsibility: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Specify maintenance responsibilities"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Special Conditions & Clauses
                        <InfoTooltip text="Any unique conditions specific to this rental agreement" />
                      </label>
                      <input
                        value={manualDraft.specialConditions}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, specialConditions: e.target.value }))}
                        className="w-full border-1 border-app_blue/20 rounded-2xl px-3 py-2 text-xs focus:border-app_yellow focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter special conditions"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Contract Policies & Terms
                        <InfoTooltip text="Standard contractual policies and legal requirements" />
                      </label>
                      <textarea
                        value={manualDraft.contractPoliciesSummary}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, contractPoliciesSummary: e.target.value }))}
                        className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm min-h-20 focus:border-app_blue focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Describe contract policies and terms"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        House Rules & Regulations
                        <InfoTooltip text="Property-specific rules the tenant must follow" />
                      </label>
                      <textarea
                        value={manualDraft.housePoliciesSummary}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, housePoliciesSummary: e.target.value }))}
                        className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm min-h-20 focus:border-app_blue focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="List house rules and regulations"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Custom Policies & Agreements
                        <InfoTooltip text="Additional policies agreed upon by both parties" />
                      </label>
                      <textarea
                        value={manualDraft.customPoliciesSummary}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, customPoliciesSummary: e.target.value }))}
                        className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm min-h-20 focus:border-app_blue focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter custom policies"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-app_grey uppercase mb-2 flex items-center gap-2">
                        Additional Terms & Important Notes
                        <InfoTooltip text="Any other important information or special agreements" />
                      </label>
                      <textarea
                        value={manualDraft.additionalTerms}
                        disabled={allContractSignaturesComplete || manualContractBusy}
                        onChange={(e) => setManualDraft((p) => ({ ...p, additionalTerms: e.target.value }))}
                        className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm min-h-20 focus:border-app_blue focus:outline-none disabled:bg-app_lightGrey/20"
                        placeholder="Enter additional terms and notes"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-2 border-t border-app_lightGrey/60 pt-4">
                  <h4 className="text-sm font-bold text-app_blue flex items-center gap-1">
                    Step 1: Collect Digital Signatures
                    <InfoTooltip text="Draw signatures directly or upload signature images for all parties" />
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {['tenant', 'owner', 'agent'].map((role) => (
                      <div key={role} className="border-2 border-app_lightGrey rounded-lg p-3 space-y-2">
                        <p className="text-xs font-bold text-app_blue uppercase flex items-center gap-1">
                          {role === 'tenant' ? 'Tenant Signature' : role === 'owner' ? 'Owner Signature' : 'Agent Signature'}
                          <InfoTooltip text={`Digital signature for the ${role}`} />
                        </p>
                        <div className="border-2 border-dashed border-app_lightGrey rounded-xl bg-app_whiteCustom/60 overflow-hidden h-28">
                          <SignatureCanvas
                            ref={(ref) => { signaturePadsRef.current[role] = ref; }}
                            penColor="#064A7E"
                            onEnd={() => captureRoleDrawnSignature(role)}
                            canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => clearRoleDrawnSignature(role)}
                          disabled={manualContractBusy}
                          className="w-full px-2 py-1.5 rounded-4xl border-2 border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 transition-all disabled:opacity-60"
                        >
                          Clear Signature
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={manualContractBusy}
                          onChange={(e) => handleRoleSignatureFile(role, e.target.files?.[0] || null)}
                          className="w-full text-xs"
                        />
                        <div className="bg-app_background/40 rounded px-2 py-1.5">
                          <p className="text-xs text-app_grey">
                            {signatureDrafts?.[role]?.drawn ? '✓ Drawn signature captured' : 'Draw signature above'}
                          </p>
                          <p className="text-xs text-app_grey">
                            {signatureDrafts?.[role]?.uploaded || signatureDrafts?.[role]?.uploadedFile
                              ? `✓ Image: ${signatureDrafts?.[role]?.fileName || 'signature.png'}`
                              : (signatureDrafts?.[role]?.drawn
                                ? 'Ready to upload on confirm'
                                : 'Or upload signature image')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-2 border-t border-app_lightGrey/60 pt-4">
                  <h4 className="text-sm font-bold text-app_blue flex items-center gap-1">
                    Step 2: Export Contract as PDF
                    <InfoTooltip text="Generate a PDF preview of the contract with all details and signatures" />
                  </h4>
                  <button
                    type="button"
                    onClick={() => exportManualContractPdf()}
                    disabled={manualContractBusy}
                    className="w-full px-5 py-2.5 rounded-4xl bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60"
                  >
                    {manualContractBusy ? 'Exporting...' : 'Export PDF'}
                  </button>
                </section>

                <section className="space-y-2 border-t border-app_lightGrey/60 pt-4 bg-app_yellow/10 px-4 py-3 rounded-lg">
                  <p className="text-xs font-semibold text-app_blue">📋 Next Step: Upload the PDF you just exported</p>
                  <p className="text-xs text-app_grey">After exporting the PDF above, use the upload section below to attach it to the contract.</p>
                </section>

                <section className="space-y-2 border-t border-app_lightGrey/60 pt-4">
                  <h4 className="text-sm font-bold text-app_blue flex items-center gap-1">
                    Step 3: Upload Contract PDF Document
                    <InfoTooltip text="Upload the PDF file you just exported above" />
                  </h4>
                  <div className="flex flex-wrap gap-2 items-center border-2 border-dashed border-app_blue/30 rounded-lg p-4 bg-app_blue/5">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setAttachedPdfFile(file);
                        setManualUploadMeta({ documentUrl: '', publicId: '', fileName: '' });
                        setManualContractError('');
                      }}
                      className="text-xs w-full"
                    />
                  </div>
                  <p className="text-xs text-app_grey">
                    Selected PDF: <span className="font-semibold text-app_blue">{attachedPdfFile?.name || 'No file selected'}</span>
                  </p>
                  {manualUploadMeta.documentUrl && (
                    <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg font-semibold">
                      ✓ Successfully uploaded: {manualUploadMeta.fileName || 'contract.pdf'}
                    </p>
                  )}
                </section>

                <section className="space-y-3 border-t border-app_lightGrey/60 pt-4">
                  <h4 className="text-sm font-bold text-app_blue flex items-center gap-1">
                    Step 4: Review & Finalize Contract
                    <InfoTooltip text="Confirm all details are correct and finalize the contract" />
                  </h4>

                  <button
                    type="button"
                    onClick={confirmManualContract}
                    disabled={!canConfirmContract}
                    className="w-full px-5 py-2.5 rounded-4xl bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60 shadow-md"
                  >
                    {manualContractBusy ? 'Confirming Contract...' : 'Confirm & Finalize Contract'}
                  </button>

                  {!areAllManualFieldsFilled && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                      <p className="text-xs text-amber-800 font-semibold">
                        ⚠ Missing required fields: {missingRequiredManualFields.map((key) => manualFieldLabels[key] || key).join(', ')}
                      </p>
                    </div>
                  )}

                  <div className={`rounded-lg px-3 py-2 border ${allContractSignaturesComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    <p className={`text-xs font-semibold flex items-center gap-2 ${allContractSignaturesComplete ? 'text-green-700' : 'text-amber-700'}`}>
                      {allContractSignaturesComplete ? '✓ All signatures complete. Contract is now locked and finalized.' : '⏳ Awaiting all party signatures to complete the contract'}
                    </p>
                  </div>

                  {manualContractError && (
                    <div className="bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                      <p className="text-xs text-red-700 font-semibold">✕ {manualContractError}</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {showUploadDocumentModal && canUploadDocuments && (
          <div className="fixed inset-0 z-50 bg-black/40 px-3 py-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl border-2 border-app_blue/10 shadow-xl">
              <div className="flex items-center justify-between px-5 py-4 sticky top-0 bg-app_blue rounded-t-2xl">
                <div>
                  <h1 className="text-2xl font-bold text-app_yellow">Upload New Document</h1>
                  <p className="text-xs font-semibold text-white uppercase mt-1">Rental Property Document</p>
                </div>
                <button
                  onClick={() => {
                    setShowUploadDocumentModal(false);
                    setDocumentForm({
                      documentType: 'other',
                      title: '',
                      description: '',
                      documentUrl: '',
                      publicId: '',
                      fileName: '',
                      isPublic: true,
                      expiresAt: '',
                      notes: '',
                    });
                  }}
                  className="px-4 py-2 rounded-4xl bg-app_whiteCustom text-app_blue text-xs font-bold hover:bg-app_yellow hover:text-app_blue transition-all"
                >
                  Close
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-app_grey uppercase mb-1 block">Document Type *</label>
                    <select
                      value={documentForm.documentType}
                      onChange={(e) => setDocumentForm((prev) => ({ ...prev, documentType: e.target.value }))}
                      className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                    >
                      <optgroup label="Core Documents">
                        <option value="contract">Contract</option>
                        <option value="inventory">Inventory / Move-in/out Checklist</option>
                        <option value="insurance">Insurance Documents</option>
                        <option value="inspection">Inspection Report</option>
                        <option value="receipt">Payment Receipt</option>
                        <option value="invoice">Invoice</option>
                        <option value="utility">Utility Bill / Proof of Payment</option>
                      </optgroup>
                      <optgroup label="Identity &amp; Legal">
                        <option value="cin">National ID (CIN)</option>
                        <option value="passport">Passport</option>
                        <option value="residence_permit">Residence Permit</option>
                        <option value="driver_license">Driver's License</option>
                      </optgroup>
                      <optgroup label="Financial &amp; Banking">
                        <option value="bank_statement">Bank Statement</option>
                        <option value="payslip">Payslip / Proof of Income</option>
                        <option value="tax_return">Tax Return</option>
                        <option value="guarantor_proof">Guarantor Income/ID Proof</option>
                        <option value="deposit_proof">Security Deposit Proof</option>
                        <option value="standing_order">Standing Order / Auto Payment</option>
                      </optgroup>
                      <optgroup label="Property Legal">
                        <option value="property_title">Property Title / Proof of Ownership</option>
                        <option value="land_registry">Land Registry Extract</option>
                        <option value="co_ownership_rules">Co-ownership / Building Rules</option>
                      </optgroup>
                      <optgroup label="Tenant History">
                        <option value="previous_contract">Previous Rental Contract</option>
                        <option value="landlord_reference">Landlord Reference</option>
                        <option value="employment_contract">Employment Contract</option>
                      </optgroup>
                      <optgroup label="Compliance &amp; Safety">
                        <option value="epc">Energy Performance Certificate</option>
                        <option value="gas_safety">Gas Safety Certificate</option>
                        <option value="electrical_safety">Electrical Safety Certificate</option>
                        <option value="asbestos_report">Asbestos Report</option>
                        <option value="lead_report">Lead Paint Report</option>
                      </optgroup>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-app_grey uppercase mb-1 block">Title *</label>
                    <input
                      value={documentForm.title}
                      onChange={(e) => setDocumentForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      placeholder="e.g., Monthly Inspection Report"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-app_grey uppercase mb-1 block">Description</label>
                  <textarea
                    value={documentForm.description}
                    onChange={(e) => setDocumentForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm min-h-16 focus:border-app_blue focus:outline-none"
                    placeholder="Optional: Add details about this document"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-app_grey uppercase mb-2 block">Upload File *</label>
                  <div className="border-2 border-dashed border-app_blue/30 rounded-lg p-4 bg-app_blue/5 hover:border-app_blue/60 transition-all">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                      onChange={(e) => handleDocumentFileUpload(e.target.files?.[0])}
                      className="w-full text-sm"
                      disabled={docsBusy}
                    />
                    <p className="text-xs text-app_grey mt-2">Supported: PDF, DOC, XLS, JPG, PNG, GIF</p>
                  </div>
                  {documentForm.fileName && (
                    <p className="text-xs text-green-700 mt-2 font-semibold">✓ {documentForm.fileName}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-app_grey uppercase mb-1 block">Expires At</label>
                    <input
                      type="date"
                      onChange={(e) => setDocumentForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                      className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-app_grey cursor-pointer w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 hover:border-app_blue transition-all">
                      <input
                        type="checkbox"
                        checked={Boolean(documentForm.isPublic)}
                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, isPublic: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span className="text-xs font-semibold uppercase">Public Document</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-app_grey uppercase mb-1 block">Notes</label>
                  <textarea
                    value={documentForm.notes || ''}
                    onChange={(e) => setDocumentForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm min-h-12 focus:border-app_blue focus:outline-none"
                    placeholder="Optional: Add any additional notes or comments"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-app_lightGrey">
                  <button
                    onClick={() => {
                      setShowUploadDocumentModal(false);
                      setDocumentForm({
                        documentType: 'other',
                        title: '',
                        description: '',
                        documentUrl: '',
                        publicId: '',
                        fileName: '',
                        isPublic: true,
                        expiresAt: '',
                        notes: '',
                      });
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg border-2 border-app_grey text-app_grey text-sm font-semibold hover:bg-app_grey/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createDocumentHandler}
                    disabled={docsBusy || !documentForm.title || !documentForm.documentUrl}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60 shadow-md"
                  >
                    {docsBusy ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
                {docsError && (
                  <p className="text-xs text-red-700 bg-red-50 px-3 py-2 rounded">{docsError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'Chat' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border-2 border-app_blue/10 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-app_blue flex items-center gap-2">
                  <FiMessageSquare className="w-4 h-4" />
                  Rental Chat
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs ${socketConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {socketConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {!!allowedThreadTypes.length && (
                <div className="flex flex-wrap gap-2">
                  {allowedThreadTypes.map((threadType) => {
                    const isActive = threadType === activeConversationType;
                    return (
                      <button
                        key={threadType}
                        onClick={() => setActiveConversationType(threadType)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isActive
                          ? 'bg-app_blue text-white shadow'
                          : 'bg-app_yellow/20 text-app_blue hover:bg-app_yellow/40'
                          }`}
                      >
                        {CHAT_THREAD_META[threadType]?.label || threadType}
                      </button>
                    );
                  })}
                </div>
              )}

              {chatError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{chatError}</p>}

              {!allowedThreadTypes.length && (
                <p className="text-sm text-app_grey bg-app_yellow/10 px-3 py-2 rounded-lg">
                  No chat thread is available for your role in this rental.
                </p>
              )}

              {!!allowedThreadTypes.length && (
                <>
                  {/* Chat Header with Other Person's Info */}
                  <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-app_blue/10 to-app_yellow/10 rounded-lg border-2 border-app_lightGrey mb-4">
                    {(() => {
                      const otherPerson = activeConversationType === RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT ? tenant : owner;
                      const otherPersonName = fullName(otherPerson) || 'Unknown';
                      const otherPersonPicture = otherPerson?.profilePictureUrl || otherPerson?.picture || otherPerson?.avatar || null;
                      return (
                        <>
                          {otherPersonPicture ? (
                            <img
                              src={otherPersonPicture}
                              alt={otherPersonName}
                              className="w-16 h-16 rounded-full object-cover border-2 border-app_blue shadow-md"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-app_blue text-white flex items-center justify-center text-lg font-bold shadow-md">
                              {otherPersonName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-app_blue">{activeConversationType === RENTAL_CHAT_CONVERSATION_TYPES.AGENT_TENANT ? 'Chatting with Tenant' : 'Chatting with Owner'}</p>
                            <p className="text-lg font-bold text-app_grey">{otherPersonName}</p>
                            <p className="text-xs text-app_grey/70 mt-1">{otherPerson?.email || 'No email'}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="h-64 overflow-y-auto border-2 border-app_lightGrey rounded-lg p-3 text-sm bg-app_yellow/5 space-y-2">
                    {activeThreadMessages.map((message, index) => {
                      const senderRole = String(message?.senderRole || 'user').replace(/_/g, ' ');
                      const isCurrentUserMessage = Boolean(
                        currentUserId && String(message?.senderId || '').trim() === currentUserId,
                      );

                      return (
                        <div
                          key={message?._id || `${activeConversationType}-msg-${index}`}
                          className={`flex ${isCurrentUserMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[90%] rounded-lg px-3 py-2 border ${isCurrentUserMessage ? 'bg-app_blue text-white border-app_blue' : 'bg-white text-app_grey border-app_lightGrey'}`}>
                            <p className={`text-[11px] uppercase tracking-wide font-semibold mb-1 ${isCurrentUserMessage ? 'text-white/80' : 'text-app_blue'}`}>
                              {senderRole}
                            </p>
                            <p className="text-sm leading-snug">{message?.content || ''}</p>
                            <p className={`text-[10px] mt-1 ${isCurrentUserMessage ? 'text-white/80' : 'text-app_grey/70'}`}>
                              {message?.createdAt ? new Date(message.createdAt).toLocaleString() : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {!activeThreadMessages.length && <p className="text-app_grey/60">No messages yet.</p>}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={activeThreadDraft}
                      onChange={(e) => {
                        const nextDraft = e.target.value;
                        setChatDrafts((prev) => ({
                          ...prev,
                          [activeConversationType]: nextDraft,
                        }));
                      }}
                      onKeyDown={async (event) => {
                        if (event.key === 'Enter') {
                          await sendThreadMessage(activeConversationType);
                        }
                      }}
                      className="flex-1 border-2 border-app_lightGrey rounded-lg px-3 py-2 text-sm focus:border-app_blue focus:outline-none"
                      placeholder={activeThreadMeta.inputPlaceholder}
                      disabled={!activeConversationId || isActiveThreadSending}
                    />
                    <button
                      onClick={async () => {
                        await sendThreadMessage(activeConversationType);
                      }}
                      disabled={!activeConversationId || isActiveThreadSending || !activeThreadDraft.trim()}
                      className="px-4 py-2 rounded-lg bg-app_blue text-white text-sm font-semibold hover:bg-app_yellow hover:text-app_blue transition-all disabled:opacity-60 shadow-md"
                    >
                      {isActiveThreadSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}


      </div>
    </section>
  );
}