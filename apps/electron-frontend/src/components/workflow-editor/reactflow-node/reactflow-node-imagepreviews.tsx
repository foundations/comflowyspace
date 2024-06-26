import { getImagePreviewUrl } from "@comflowy/common/comfyui-bridge/bridge";
import { PreviewImage } from "@comflowy/common/types";
import { PreviewGroupWithDownload } from "../reactflow-gallery/image-with-download";
import { Image } from 'antd';
import {memo} from "react";

export const NodeImagePreviews = memo(({ imagePreviews }: {
  imagePreviews: PreviewImage[]
}) => {
  const imagePreviewsWithSrc = (imagePreviews || []).map((image, index) => {
    if (image.blobUrl) {
      return {
        src: image.blobUrl,
        filename: image.filename || "Untitled"
      }
    }
    const imageSrc = getImagePreviewUrl(image.filename, image.type, image.subfolder)
    return {
      src: imageSrc,
      filename: image.filename
    }
  });

  return (
    <div className={`node-images-preview ${imagePreviews.length > 1 ? "multiple" : "single"}`} >
      <div className="inner">
        <PreviewGroupWithDownload images={imagePreviewsWithSrc}>
          {
            imagePreviewsWithSrc.map((image, index) => {
              return (
                <Image
                  key={image.src + index}
                  className="node-preview-image"
                  src={image.src}
                />
              )
            })
          }
        </PreviewGroupWithDownload>
      </div>
    </div>
  )
});

