/** Columns for list cards, Reels feed, search — omit heavy text/json fields. */
export const LISTING_SUMMARY_COLUMNS =
  'id, owner_id, is_demo, title, make, model, year, price, mileage, fuel, transmission, power, location, country, video_poster, video_duration, video_url, stream_uid, image_urls, seller_name, seller_type, seller_status, seller_rating, seller_response_time, seller_avatar_url, unique_views, created_at, processing_status' as const
