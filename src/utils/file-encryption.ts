/**
 * File & Attachment Encryption
 * Extends encryption to support images, documents, and other files
 */

import { MessageEncryption } from './encryption-enterprise';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface EncryptedFile {
  encryptedData: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  thumbnail?: string;
  version: number;
  iv: string;
  key: string;
  timestamp: number;
  messageId: string;
  senderFingerprint: string;
}

export class FileEncryption {
  static async encryptFile(file: File, recipientId: string): Promise<string> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    try {
      const fileBuffer = await file.arrayBuffer();

      const sessionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        sessionKey,
        fileBuffer
      );

      const recipientPublicKey = await (MessageEncryption as any).getPublicKey(recipientId);

      if (!recipientPublicKey) {
        throw new Error('Recipient has no encryption keys');
      }

      const rawSessionKey = await crypto.subtle.exportKey('raw', sessionKey);
      const encryptedSessionKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        recipientPublicKey,
        rawSessionKey
      );

      let thumbnail: string | undefined;
      if (file.type.startsWith('image/')) {
        thumbnail = await this.generateThumbnail(file);
      }

      const keyPair = (MessageEncryption as any).keyPair;
      const senderFingerprint = await (MessageEncryption as any).generateFingerprint(keyPair.publicKey);

      const payload: EncryptedFile = {
        encryptedData: this.arrayBufferToBase64(encryptedData),
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        thumbnail,
        version: 1,
        iv: this.arrayBufferToBase64(iv.buffer),
        key: this.arrayBufferToBase64(encryptedSessionKey),
        timestamp: Date.now(),
        messageId: crypto.randomUUID(),
        senderFingerprint,
      };

      return `🔒FILE:${btoa(JSON.stringify(payload))}`;
    } catch (error) {
      console.error('❌ [FILE ENCRYPTION] Failed:', error);
      throw error;
    }
  }

  static async decryptFile(encryptedPayload: string, senderId: string): Promise<Blob> {
    if (!encryptedPayload.startsWith('🔒FILE:')) {
      throw new Error('Invalid encrypted file format');
    }

    try {
      const payloadString = encryptedPayload.replace('🔒FILE:', '');
      const payload: EncryptedFile = JSON.parse(atob(payloadString));

      const senderPublicKey = await (MessageEncryption as any).getPublicKey(senderId);
      if (senderPublicKey) {
        const expectedFingerprint = await (MessageEncryption as any).generateFingerprint(senderPublicKey);
        if (payload.senderFingerprint !== expectedFingerprint) {
          throw new Error('Sender fingerprint mismatch');
        }
      }

      const keyPair = (MessageEncryption as any).keyPair;

      const encryptedSessionKeyBuffer = this.base64ToArrayBuffer(payload.key);
      const rawSessionKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        keyPair.privateKey,
        encryptedSessionKeyBuffer
      );

      const sessionKey = await crypto.subtle.importKey(
        'raw',
        rawSessionKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const iv = this.base64ToArrayBuffer(payload.iv);
      const encryptedData = this.base64ToArrayBuffer(payload.encryptedData);

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        sessionKey,
        encryptedData
      );

      return new Blob([decryptedData], { type: payload.fileType });
    } catch (error) {
      console.error('❌ [FILE DECRYPTION] Failed:', error);
      throw error;
    }
  }

  private static async generateThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const maxSize = 100;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
          } else {
            if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  static isEncryptedFile(content: string): boolean {
    return content.startsWith('🔒FILE:');
  }

  static getFileMetadata(encryptedPayload: string): {
    fileName: string; fileType: string; fileSize: number; thumbnail?: string;
  } | null {
    try {
      if (!encryptedPayload.startsWith('🔒FILE:')) return null;
      const payloadString = encryptedPayload.replace('🔒FILE:', '');
      const payload: EncryptedFile = JSON.parse(atob(payloadString));
      return {
        fileName: payload.fileName,
        fileType: payload.fileType,
        fileSize: payload.fileSize,
        thumbnail: payload.thumbnail,
      };
    } catch {
      return null;
    }
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  }
}