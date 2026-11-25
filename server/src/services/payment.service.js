import crypto from 'crypto';
import qs from 'qs';
import dotenv from 'dotenv';
dotenv.config();

const isProductionEnv = () =>
  process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

function formatVietnamTimestamp(date = new Date()) {
  // VNPay explicitly requires GMT+7 (Asia/Ho_Chi_Minh), whereas Render servers run in UTC
  const gmt7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    gmt7.getUTCFullYear() +
    pad(gmt7.getUTCMonth() + 1) +
    pad(gmt7.getUTCDate()) +
    pad(gmt7.getUTCHours()) +
    pad(gmt7.getUTCMinutes()) +
    pad(gmt7.getUTCSeconds())
  );
}

function normalizeClientIp(ipAddr = '127.0.0.1') {
  const raw = String(ipAddr || '').split(',')[0].trim();
  if (!raw || raw === '::1') return '127.0.0.1';
  const ipv4Mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) return ipv4Mapped[1];
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) return raw;
  return '127.0.0.1';
}

/**
 * Sorts object keys alphabetically and URI-encodes values according to VNPay specifications
 */
export function sortObject(obj) {
  const sorted = {};
  const str = [];
  let key;
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
}

/**
 * Generates the official VNPay redirect payment URL
 */
export function createVNPayPaymentUrl({
  bookingId,
  amount,
  currency,
  bankCode = '',
  orderInfo = '',
  ipAddr = '127.0.0.1',
  locale = 'vn',
  returnUrl: customReturnUrl = '',
}) {
  const tmnCode = process.env.VNP_TMN_CODE || '2QXUI4J4';
  const secretKey = process.env.VNP_HASH_SECRET || 'RAOANNFADDQXRIWAAXGQUXSXFCUQNODZ';
  const vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  const defaultProdReturn = 'https://nexstay-hotel-nuxh.onrender.com/api/payment/vnpay_return';
  const envReturn = process.env.VNP_RETURN_URL;
  const prod = isProductionEnv();
  const returnUrl =
    customReturnUrl ||
    (envReturn && !(prod && envReturn.includes('localhost'))
      ? envReturn
      : prod
      ? defaultProdReturn
      : 'http://localhost:5000/api/payment/vnpay_return');

  const createDate = formatVietnamTimestamp(new Date());

  // Normalize proxy / IPv6 addresses to IPv4 for VNPay Sandbox compatibility
  const cleanIp = normalizeClientIp(ipAddr);

  const numericAmount = Number(amount || 0);
  let calculatedAmountVND = numericAmount;
  if (currency === 'USD' || (!currency && numericAmount < 10000)) {
    calculatedAmountVND = Math.round(numericAmount * 25400);
  }
  const vnpAmount = Math.round(calculatedAmountVND * 100);

  let vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: locale,
    vnp_CurrCode: 'VND',
    vnp_TxnRef: bookingId,
    vnp_OrderInfo: orderInfo || `Thanh toan phong NexStay #${bookingId.slice(0, 8)}`,
    vnp_OrderType: 'other',
    vnp_Amount: vnpAmount,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: cleanIp,
    vnp_CreateDate: createDate,
  };

  if (bankCode && bankCode.trim() !== '') {
    vnp_Params['vnp_BankCode'] = bankCode;
  }

  vnp_Params = sortObject(vnp_Params);

  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  vnp_Params['vnp_SecureHash'] = signed;

  return `${vnpUrl}?${qs.stringify(vnp_Params, { encode: false })}`;
}

/**
 * Validates the VNPay return checksum hash
 */
export function verifyVNPayReturn(queryParams) {
  let vnp_Params = { ...queryParams };
  const secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);

  const secretKey = process.env.VNP_HASH_SECRET || 'RAOANNFADDQXRIWAAXGQUXSXFCUQNODZ';
  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey);
  const calculatedHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  const providedHash = typeof secureHash === 'string' ? secureHash.trim().toLowerCase() : '';
  const expectedHash = calculatedHash.toLowerCase();
  const isValid =
    providedHash.length > 0 &&
    providedHash.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(providedHash, 'utf8'), Buffer.from(expectedHash, 'utf8'));
  const txnStatus = vnp_Params['vnp_TransactionStatus'];
  const isSuccess =
    isValid &&
    vnp_Params['vnp_ResponseCode'] === '00' &&
    (!txnStatus || txnStatus === '00');

  return {
    isValid,
    isSuccess,
    bookingId: vnp_Params['vnp_TxnRef'],
    responseCode: vnp_Params['vnp_ResponseCode'],
    transactionNo: vnp_Params['vnp_TransactionNo'],
    bankCode: vnp_Params['vnp_BankCode'],
    amount: vnp_Params['vnp_Amount'] ? Number(vnp_Params['vnp_Amount']) / 100 : 0,
    rawParams: vnp_Params,
  };
}

export default {
  sortObject,
  createVNPayPaymentUrl,
  verifyVNPayReturn,
};
