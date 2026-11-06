import crypto from 'node:crypto';

function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content]);
}

function seq(...items: Buffer[]): Buffer {
  return tlv(0x30, Buffer.concat(items));
}

function set(...items: Buffer[]): Buffer {
  return tlv(0x31, Buffer.concat(items));
}

function oid(dotNotation: string): Buffer {
  const parts = dotNotation.split('.').map(Number);
  const first = (parts[0] ?? 0) * 40 + (parts[1] ?? 0);
  const bytes = [first];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i] ?? 0;
    const sub: number[] = [val & 0x7f];
    val >>= 7;
    while (val > 0) {
      sub.unshift((val & 0x7f) | 0x80);
      val >>= 7;
    }
    bytes.push(...sub);
  }
  return tlv(0x06, Buffer.from(bytes));
}

function int(value: Buffer | number): Buffer {
  let buf = typeof value === 'number' ? Buffer.from([value]) : value;
  while (buf.length > 1 && buf[0] === 0x00) {
    buf = buf.subarray(1);
  }
  if ((buf[0] ?? 0) & 0x80) {
    buf = Buffer.concat([Buffer.from([0x00]), buf]);
  }
  return tlv(0x02, buf);
}

function utf8String(str: string): Buffer {
  return tlv(0x0c, Buffer.from(str, 'utf8'));
}

function utcTime(date: Date): Buffer {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = pad(date.getUTCFullYear() % 100);
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return tlv(0x17, Buffer.from(`${yy}${mm}${dd}${hh}${mi}${ss}Z`, 'ascii'));
}

function bitString(content: Buffer): Buffer {
  return tlv(0x03, Buffer.concat([Buffer.from([0x00]), content]));
}

function octetString(content: Buffer): Buffer {
  return tlv(0x04, content);
}

function explicit(tagNum: number, content: Buffer): Buffer {
  return tlv(0xa0 | tagNum, content);
}

function rdnCommonName(cn: string): Buffer {
  // OID 2.5.4.3 = commonName
  return seq(set(seq(oid('2.5.4.3'), utf8String(cn))));
}

function derToPem(der: Buffer, label: string): string {
  const b64 = der
    .toString('base64')
    .replace(/(.{64})/g, '$1\n')
    .trim();
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

// OID 1.2.840.113549.1.1.11 = sha256WithRSAEncryption
const ALG_SHA256_RSA = seq(oid('1.2.840.113549.1.1.11'), Buffer.from([0x05, 0x00]));

function buildX509Pem(params: {
  subjectCN: string;
  issuerCN: string;
  subjectPublicKey: crypto.KeyObject;
  issuerPrivateKey: crypto.KeyObject;
  isCA: boolean;
  sanLocalhost?: boolean;
}): string {
  const spkiDer = params.subjectPublicKey.export({ type: 'spki', format: 'der' });
  const serial = int(crypto.randomBytes(12));
  const now = new Date(Date.now() - 60_000);
  const exp = new Date(Date.now() + 24 * 3600 * 1000);
  const validity = seq(utcTime(now), utcTime(exp));

  const extensions: Buffer[] = [];
  // BasicConstraints (2.5.29.19)
  const bcValue = params.isCA ? seq(Buffer.from([0x01, 0x01, 0xff])) : seq();
  extensions.push(seq(oid('2.5.29.19'), Buffer.from([0x01, 0x01, 0xff]), octetString(bcValue)));

  if (params.sanLocalhost) {
    // SubjectAltName (2.5.29.17): dNSName [2] "localhost", iPAddress [7] 127.0.0.1
    const dnsLocalhost = tlv(0x82, Buffer.from('localhost', 'ascii'));
    const ipLoopback = tlv(0x87, Buffer.from([127, 0, 0, 1]));
    extensions.push(seq(oid('2.5.29.17'), octetString(seq(dnsLocalhost, ipLoopback))));
  }

  const tbs = seq(
    explicit(0, int(2)), // v3
    serial,
    ALG_SHA256_RSA,
    rdnCommonName(params.issuerCN),
    validity,
    rdnCommonName(params.subjectCN),
    spkiDer,
    explicit(3, seq(...extensions)),
  );

  const signature = crypto.sign('RSA-SHA256', tbs, params.issuerPrivateKey);
  const certDer = seq(tbs, ALG_SHA256_RSA, bitString(signature));
  return derToPem(certDer, 'CERTIFICATE');
}

export interface TestMtlsBundle {
  caCert: string;
  serverCert: string;
  serverKey: string;
  clientCert: string;
  clientEncryptedKey: string;
  clientPassphrase: string;
  signingPrivateKey: string;
  signingPublicKey: string;
  untrustedClientCert: string;
  untrustedClientKey: string;
}

/**
 * Генерирует полный комплект X.509 v3 сертификатов (Root CA, Server, Client с паролем и пару RSA для X-Signature)
 * исключительно средствами встроенного `node:crypto` без OpenSSL CLI.
 */
export function generateTestMtlsBundle(): TestMtlsBundle {
  const caKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const serverKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const clientKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const signKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rogueCaKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rogueClientKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

  const caCert = buildX509Pem({
    subjectCN: 'OrangeData Test Root CA',
    issuerCN: 'OrangeData Test Root CA',
    subjectPublicKey: caKeys.publicKey,
    issuerPrivateKey: caKeys.privateKey,
    isCA: true,
  });

  const serverCert = buildX509Pem({
    subjectCN: 'localhost',
    issuerCN: 'OrangeData Test Root CA',
    subjectPublicKey: serverKeys.publicKey,
    issuerPrivateKey: caKeys.privateKey,
    isCA: false,
    sanLocalhost: true,
  });

  const clientCert = buildX509Pem({
    subjectCN: 'Test Merchant Client',
    issuerCN: 'OrangeData Test Root CA',
    subjectPublicKey: clientKeys.publicKey,
    issuerPrivateKey: caKeys.privateKey,
    isCA: false,
  });

  const clientPassphrase = 'test-passphrase-1234';
  const clientEncryptedKey = clientKeys.privateKey
    .export({
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: clientPassphrase,
    })
    .toString();

  const untrustedClientCert = buildX509Pem({
    subjectCN: 'Rogue Client',
    issuerCN: 'Rogue CA',
    subjectPublicKey: rogueClientKeys.publicKey,
    issuerPrivateKey: rogueCaKeys.privateKey,
    isCA: false,
  });

  return {
    caCert,
    serverCert,
    serverKey: serverKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    clientCert,
    clientEncryptedKey,
    clientPassphrase,
    signingPrivateKey: signKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    signingPublicKey: signKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    untrustedClientCert,
    untrustedClientKey: rogueClientKeys.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString(),
  };
}
