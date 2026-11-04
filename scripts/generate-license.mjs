import crypto from 'node:crypto';

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
const privateKeyDer = privateKey.export({ type: 'pkcs8', format: 'der' });

const publicKeyBase64 = Buffer.from(publicKeyDer).toString('base64');
const privateKeyBase64 = Buffer.from(privateKeyDer).toString('base64');

console.log('Aurora ERP license key generator');
console.log('');
console.log('PUBLIC_KEY (set as LICENSE_PUBLIC_KEY):');
console.log(publicKeyBase64);
console.log('');
console.log('PRIVATE_KEY (keep secret, do not commit):');
console.log(privateKeyBase64);
console.log('');

if (args.licensee) {
  const edition = args.edition || 'professional';
  const payload = {
    licensee: args.licensee,
    edition,
    issuedAt: new Date().toISOString(),
    licenseId: args.licenseId || crypto.randomUUID(),
  };
  if (args.expires) payload.expiresAt = new Date(args.expires).toISOString();
  if (args.maxOrganizations) payload.maxOrganizations = Number(args.maxOrganizations);
  if (args.maxUsers) payload.maxUsers = Number(args.maxUsers);
  if (args.features) payload.features = args.features.split(',').map((value) => value.trim()).filter(Boolean);

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson).toString('base64url');
  const signature = crypto.sign(null, Buffer.from(payloadBase64, 'utf8'), privateKey);
  const licenseKey = `AURORA.${payloadBase64}.${signature.toString('base64url')}`;

  console.log('LICENSE_KEY (set as LICENSE_KEY):');
  console.log(licenseKey);
  console.log('');
  console.log('Payload:');
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log('No --licensee provided. Generated a fresh keypair only.');
  console.log('Re-run with --licensee="Customer Name" to issue a license.');
}