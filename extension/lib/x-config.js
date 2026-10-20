// GENERATED from fetch/fetch-followers.js by extension/build.mjs — do not edit.
(() => {

  const CONFIG = {
    // Whose followers? '' = the logged-in account; or e.g. 'some_user' (no @).
    // 抓谁的粉丝？留空 = 当前登录账号；也可以填别人的用户名（不带 @）。
    TARGET_SCREEN_NAME: '',
    ASK_TARGET: false,             // true → prompt() for a screen name (the bookmarklet sets this)
    LANG: '',                      // log language: '' = auto (browser language), 'zh' or 'en'

    ENDPOINTS: ['Followers', 'BlueVerifiedFollowers'], // follower lists to read (deduped)
    COUNT_PER_PAGE: 20,            // users per page (X returns ~20)
    DELAY_MS: 5000,                // pause between page requests / 每页间隔（毫秒）
    JITTER_MS: 1500,               // + random 0..JITTER_MS
    MAX_PAGES_PER_ENDPOINT: 100,   // safety cap / 每个接口最多翻页数
    MAX_USERS: 500,                // stop after N unique users (max 5000) / 最多抓取人数（最多 5000）
    MAX_429_RETRIES: 3,            // times to wait out a rate limit before giving up
    AUTO_DISCOVER_QUERY_IDS: true, // read current queryIds from x.com's own JS bundle

    // Fallback GraphQL queryIds — X changes them occasionally. If you get a 404:
    // DevTools → Network → filter "graphql" on a followers page → copy <ID> from
    // /i/api/graphql/<ID>/Followers and paste it here.
    // queryId 会变：报 404 时在 Network 面板找到 /graphql/<ID>/Followers 替换即可。
    QUERY_IDS: {
      Followers: 'IOh4aS6UdGWGJUYTqliQ7Q',
      BlueVerifiedFollowers: '1fjk4lmK45a-giaZTubqbg',
      UserByScreenName: 'x3RLKWW1Tl7JgU7YtGxuzw',
    },

    // Public bearer token embedded in the x.com web client (identical for every visitor;
    // NOT your credential). Your session is identified by your own browser cookies.
    BEARER: 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',

    // Feature flags. If X starts requiring a new one, the script parses the 400 error
    // ("features cannot be null: ...") and adds it automatically.
    FEATURES: {
      rweb_video_screen_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: true,
      responsive_web_jetfuel_frame: false,
      responsive_web_grok_share_attachment_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_enhance_cards_enabled: false,
      hidden_profile_subscriptions_enabled: true,
      subscriptions_verification_info_is_identity_verified_enabled: true,
      subscriptions_verification_info_verified_since_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: true,
      subscriptions_feature_can_gift_premium: true,
    },
  };
  
self.XAM_CONFIG = CONFIG;
})();
