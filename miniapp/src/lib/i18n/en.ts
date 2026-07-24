// English translation dictionary.
// All keys must exist here — Amharic is typed as `typeof en` so missing
// Amharic keys are compile errors.

export const en = {
  // ── Generic ──────────────────────────────────────────────────────────────
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong.',
  'common.retry': 'Retry',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.remove': 'Remove',
  'common.refresh': 'Refresh',
  'common.backToTop': 'Back to top',
  'common.optional': 'Optional',
  'common.or': 'or',
  'common.yes': 'Yes',
  'common.no': 'No',

  // ── Tabs ──────────────────────────────────────────────────────────────────
  'tab.feed': 'Feed',
  'tab.people': 'People',
  'tab.purchases': 'Purchases',
  'tab.profile': 'Profile',

  // ── Language toggle ───────────────────────────────────────────────────────
  'lang.toggleToAm': 'አማ',
  'lang.toggleToEn': 'EN',

  // ── Auth / dev login ──────────────────────────────────────────────────────
  'auth.devLogin': 'Dev login',
  'auth.devLoginSubtitle': 'Sign in outside Telegram for local development.',
  'auth.telegramId': 'Telegram ID',
  'auth.telegramIdHint': 'Numeric ID, e.g. 987654321',
  'auth.token': 'JWT token',
  'auth.login': 'Log in',
  'auth.loginWithTelegramId': 'Log in with Telegram ID',
  'auth.loginWithToken': 'Log in with token',
  'auth.devLoginDisabled': 'Development login is disabled.',
  'auth.signingIn': 'Signing in…',
  'auth.enterToken': 'Please enter a token.',
  'auth.enterTelegramId': 'Please enter a Telegram ID.',

  // ── Splash ────────────────────────────────────────────────────────────────
  'splash.tagline': 'Find your lateral match.',

  // ── Profile ───────────────────────────────────────────────────────────────
  'profile.completeProfile': 'Complete your profile',
  'profile.completeProfileSubtitle': 'The marketplace unlocks once your profile is complete.',
  'profile.title': 'Profile',
  'profile.fullNameEn': 'Full name (English)',
  'profile.fullNameAm': 'Full name (Amharic)',
  'profile.branchNameEn': 'Branch name (English)',
  'profile.branchNameAm': 'Branch name (Amharic)',
  'profile.neighborhoodEn': 'Neighborhood (English)',
  'profile.neighborhoodAm': 'Neighborhood (Amharic)',
  'profile.grade': 'Grade',
  'profile.region': 'Region',
  'profile.zone': 'Zone',
  'profile.language': 'Language',
  'profile.photo': 'Photo',
  'profile.uploadPhoto': 'Upload photo',
  'profile.changePhoto': 'Change photo',
  'profile.deletePhoto': 'Delete photo',
  'profile.bank': 'Bank',
  'profile.currentLocation': 'Current location',
  'profile.selectOption': 'Select…',
  'profile.saved': 'Profile saved.',
  'profile.profileUpdated': 'Profile updated.',
  'profile.photoUpdated': 'Photo updated.',
  'profile.photoDeleted': 'Photo deleted.',
  'profile.signOut': 'Sign out',
  'profile.signOutConfirm': 'Are you sure you want to sign out?',

  // ── Completeness ──────────────────────────────────────────────────────────
  'completeness.title': 'Profile completeness',
  'completeness.complete': 'Your profile is complete.',
  'completeness.incomplete': 'Complete the highlighted fields to unlock the marketplace.',
  'completeness.score': '{score}%',
  'completeness.missingField.full_name': 'Full name',
  'completeness.missingField.branch_name': 'Branch name',
  'completeness.missingField.neighborhood': 'Neighborhood',
  'completeness.missingField.grade': 'Grade',
  'completeness.missingField.transfer_interest': 'Transfer interest',
  'completeness.missingField.custom_photo': 'Custom photo',

  // ── Interests ─────────────────────────────────────────────────────────────
  'interests.title': 'Transfer interests',
  'interests.subtitle': 'Where do you want to move?',
  'interests.addInterest': 'Add interest',
  'interests.noInterests': 'No transfer interests yet.',
  'interests.noInterestsHint': 'Add at least one region or zone to see matching candidates.',
  'interests.broadRegion': 'Whole region (any zone)',
  'interests.selectedInterests': 'Your interests',
  'interests.maxRegions': 'Max {n} regions',
  'interests.maxZonesPerRegion': 'Max {n} zones per region',
  'interests.broadWithZones': 'A region cannot have both a broad interest and specific zones.',
  'interests.interestsSaved': 'Interests saved.',
  'interests.pickRegionFirst': 'Pick a region first.',
  'interests.regionFull': 'Region limit reached.',
  'interests.allRegionsFull': 'All region slots used.',
  'interests.zoneAny': 'Any zone',

  // ── Marketplace ───────────────────────────────────────────────────────────
  'marketplace.mutual': 'Mutual',
  'marketplace.matchZone': 'Zone match',
  'marketplace.matchRegion': 'Region match',
  'marketplace.gradeMatch': 'Grade ±1',
  'marketplace.purchased': 'Unlocked',
  'marketplace.viewed': 'Viewed',
  'marketplace.unlock': 'Unlock contact',
  'marketplace.unlockCta': 'Unlock',
  'marketplace.unlockFor': 'Unlock for {amount} {currency}',
  'marketplace.unlockPrice': '{amount} {currency}',
  'marketplace.unlockBody': 'Reveal this candidate\'s name, phone, Telegram, branch, and neighborhood.',
  'marketplace.unlockConfirm': 'You will be redirected to Chapa to complete payment.',
  'marketplace.purchasePending': 'Payment pending',
  'marketplace.paymentOpened': 'A payment window was opened. Complete the payment, then check the status.',
  'marketplace.paymentOpenedNoUrl': 'Payment initiated. Check status in your purchases.',
  'marketplace.checkStatus': 'Check status',
  'marketplace.purchaseFailed': 'Purchase failed. Please try again.',
  'marketplace.purchaseAlreadyExists': 'You already have a pending purchase for this candidate.',
  'marketplace.contactRevealed': 'Contact revealed!',
  'marketplace.contactRevealedBody': 'You can now see this candidate\'s full details.',
  'marketplace.shortlist': 'Save',
  'marketplace.shortlisted': 'Saved',
  'marketplace.unshortlist': 'Unsave',
  'marketplace.relevanceHigh': 'Top match',
  'marketplace.relevanceMedium': 'Good match',
  'marketplace.relevanceLow': 'Match',
  'marketplace.resultsCount': '{n} candidates',

  // ── Card field labels ─────────────────────────────────────────────────────
  'card.name': 'Name',
  'card.maskedName': 'Name hidden',
  'card.branch': 'Branch',
  'card.neighborhood': 'Neighborhood',
  'card.phone': 'Phone',
  'card.telegram': 'Telegram',
  'card.gradeLabel': 'Grade',
  'card.bandLabel': 'Band',
  'card.location': 'Location',

  // ── Empty / error / loading states ────────────────────────────────────────
  'empty.noResults': 'No results',
  'empty.noResultsFeed': 'No candidates want to move into your area yet.',
  'empty.noResultsFeedHint': 'Try adding more transfer interests or check back later.',
  'empty.noResultsPeople': 'No candidates in your desired areas yet.',
  'empty.noResultsPeopleHint': 'Try expanding your transfer interests to more regions or zones.',
  'empty.noResultsPurchases': 'No unlocked contacts yet.',
  'empty.noResultsPurchasesHint': 'Unlock a candidate\'s contact from the Feed or People tab.',
  'empty.noResultsNotifications': 'No notifications yet.',
  'empty.noResultsNotificationsHint': 'Updates about your matches and purchases will appear here.',
  'empty.noResultsShortlist': 'No saved candidates yet.',
  'empty.noResultsShortlistHint': 'Tap the bookmark icon on any candidate to save them for later.',
  'empty.requiresInterests': 'Add transfer interests first',
  'empty.requiresInterestsHint': 'The People tab needs at least one transfer interest to show matching candidates.',
  'state.loadingMore': 'Loading more…',

  // ── Feed / People page ────────────────────────────────────────────────────
  'feed.title': 'Feed',
  'feed.subtitle': 'Candidates who want to move into your area',
  'people.title': 'People',
  'people.subtitle': 'Candidates in your desired areas',

  // ── Filters ───────────────────────────────────────────────────────────────
  'filter.title': 'Filters',
  'filter.mutualOnly': 'Mutual matches only',
  'filter.gradeBand': 'Grade band',
  'filter.region': 'Region',
  'filter.zone': 'Zone',
  'filter.apply': 'Apply',
  'filter.clear': 'Clear all',
  'filter.anyBand': 'Any band',
  'filter.anyRegion': 'Any region',
  'filter.anyZone': 'Any zone',

  // ── Purchases page ────────────────────────────────────────────────────────
  'purchases.title': 'Your unlocked contacts',
  'purchases.subtitle': 'Candidates whose contact info you have revealed',
  'purchases.purchasedOn': 'Unlocked on {date}',
  'purchases.pending': 'Pending payments',
  'purchases.pendingHint': 'These payments are still being verified.',
  'purchases.statsTotal': 'Total spent',
  'purchases.statsReveals': 'Total reveals',
  'purchases.statsThisMonth': 'This month',
  'purchases.statsPending': 'Pending payments',
  'purchases.viewAll': 'View all',
  'purchases.viewPending': 'View pending',
  'purchases.viewCompleted': 'View completed',

  // ── Notifications ─────────────────────────────────────────────────────────
  'notifications.title': 'Notifications',
  'notifications.new': 'New',
  'notifications.markAllRead': 'Mark all as read',
  'notifications.type.payment_confirmation': 'Payment',
  'notifications.type.profile_nudge': 'Reminder',
  'notifications.type.broadcast': 'Announcement',
  'notifications.type.digest': 'Summary',

  // ── Shortlist page ────────────────────────────────────────────────────────
  'shortlist.title': 'Saved candidates',
  'shortlist.subtitle': 'Your bookmarked candidates for later',

  // ── Validation ────────────────────────────────────────────────────────────
  'validation.requiredOneLanguage': 'At least one language version is required.',
  'validation.branchMin': 'Must be at least 3 characters.',
  'validation.neighborhoodMin': 'Must be at least 2 characters.',
  'validation.gradeRequired': 'Grade is required.',
  'validation.regionRequired': 'Region is required.',
  'validation.zoneRequired': 'Zone is required.',
  'validation.invalidPhotoType': 'Invalid file type. Allowed: JPEG, PNG, WEBP.',
  'validation.invalidPhotoSize': 'File too large. Maximum 5 MB.',
  'validation.invalidTelegramId': 'Telegram ID must be a positive number.'
};

// Dictionary type — same keys as `en`, but values are `string` (not literal types)
// so the Amharic dictionary can have different string values per key.
export type Dictionary = { [K in keyof typeof en]: string };
