/** Largest file the portal accepts for upload (Supabase free plan limit), in MB.
 *  Kept in its own tiny file so screens that only need this number don't pull in
 *  the slide-import code and its zip library. */
export const MAX_UPLOAD_MB = 50;
