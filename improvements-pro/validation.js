export function validateQuantity(value) {
  if (value === '' || value === null || value === undefined) {
    return 'Quantity is required';
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'Quantity must be a number';
  }
  if (num <= 0) {
    return 'Quantity must be greater than 0';
  }
  if (num > 1e9) {
    return 'Quantity is unrealistically large';
  }
  const decimals = (value.split('.')[1] || '').length;
  if (decimals > 8) {
    return 'Maximum 8 decimal places allowed';
  }
  return null;
}

export function validatePrice(value) {
  if (value === '' || value === null || value === undefined) {
    return 'Price is required';
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'Price must be a number';
  }
  if (num <= 0) {
    return 'Price must be greater than 0';
  }
  if (num > 1e12) {
    return 'Price is unrealistically large';
  }
  return null;
}

export function validateTargetPrice(value) {
  if (value === '' || value === null || value === undefined) {
    return 'Target price is required';
  }
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'Target price must be a number';
  }
  if (num <= 0) {
    return 'Target price must be greater than 0';
  }
  return null;
}

export function validateWalletAddress(value) {
  if (!value || !value.trim()) {
    return 'Wallet address is required';
  }
  const address = value.trim();
  if (!address.startsWith('0x')) {
    return 'Address must start with 0x';
  }
  if (address.length !== 42) {
    return 'Address must be 42 characters long';
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 'Address contains invalid characters';
  }
  return null;
}

export function validateTxHash(value) {
  if (!value || !value.trim()) {
    return 'Transaction hash is required';
  }
  const hash = value.trim();
  if (!hash.startsWith('0x')) {
    return 'Hash must start with 0x';
  }
  if (hash.length !== 66) {
    return 'Transaction hash must be 66 characters long';
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return 'Hash contains invalid characters';
  }
  return null;
}
