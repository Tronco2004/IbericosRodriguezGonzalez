import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: import.meta.env.CLOUDINARY_API_KEY,
  api_secret: import.meta.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Genera una URL de Cloudinary optimizada
 * @param publicId - ID público de la imagen en Cloudinary
 * @param options - Opciones de transformación
 */
export function getCloudinaryUrl(publicId: string, options?: Record<string, any>): string {
  const baseUrl = `https://res.cloudinary.com/${import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/`;
  
  if (!options) {
    return `${baseUrl}${publicId}`;
  }

  // Construir string de transformación
  const transforms = [];
  if (options.width || options.height) {
    const size = `w_${options.width || 'auto'},h_${options.height || 'auto'},c_${options.crop || 'fill'}`;
    transforms.push(size);
  }
  if (options.quality) {
    transforms.push(`q_${options.quality}`);
  }
  if (options.format) {
    transforms.push(`f_${options.format}`);
  }

  const transformString = transforms.join(',');
  return `${baseUrl}${transformString ? transformString + '/' : ''}${publicId}`;
}

/**
 * Sube un archivo a Cloudinary
 * @param file - Buffer o stream del archivo
 * @param folder - Carpeta en Cloudinary donde guardar
 * @param resourceType - Tipo de recurso (image, video, etc)
 */
export async function uploadToCloudinary(
  file: Buffer | NodeJS.ReadableStream,
  folder: string = 'productos',
  resourceType: string = 'image'
): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    if (Buffer.isBuffer(file)) {
      uploadStream.end(file);
    } else {
      file.pipe(uploadStream);
    }
  });
}

/**
 * Elimina un archivo de Cloudinary
 * @param publicId - ID público de la imagen
 */
export async function deleteFromCloudinary(publicId: string): Promise<any> {
  return cloudinary.uploader.destroy(publicId);
}
