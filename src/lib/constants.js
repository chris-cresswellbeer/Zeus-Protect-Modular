const ACCEPT_IMAGES = ["image/jpeg","image/png","image/gif","image/webp"].join(",");
const ACCEPT_VIDEO  = ["video/mp4","video/webm","video/ogg","video/quicktime"].join(",");
const ACCEPT_IMG_DOCS = ACCEPT_IMAGES + ",.pdf,.doc,.docx";

export { ACCEPT_IMAGES, ACCEPT_VIDEO, ACCEPT_IMG_DOCS };
