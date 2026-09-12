export const siteCategories = [
  {
    id: "ecommerce",
    name: "E-Commerce & Marketplaces",
    icon: "ShoppingCart",
    description: "Product listings, pricing, reviews, and inventory data",
    subcategories: [
      {
        name: "General Retail",
        sites: [
          { name: "Amazon", url: "https://www.amazon.com", difficulty: "Hard", capabilities: ["scraper", "clone_engine"] },
          { name: "eBay", url: "https://www.ebay.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "Walmart", url: "https://www.walmart.com", difficulty: "Hard", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Niche & Handmade",
        sites: [
          { name: "Etsy", url: "https://www.etsy.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "Shopify Stores", url: "https://www.shopify.com", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
        ],
      },
    ],
  },
  {
    id: "real-estate",
    name: "Real Estate & Property",
    icon: "Building2",
    description: "Property listings, owner records, valuations, and MLS data",
    subcategories: [
      {
        name: "Listing Portals",
        sites: [
          { name: "Zillow", url: "https://www.zillow.com", difficulty: "Hard", capabilities: ["scraper", "ai_agent"] },
          { name: "Realtor.com", url: "https://www.realtor.com", difficulty: "Hard", capabilities: ["scraper"] },
          { name: "Redfin", url: "https://www.redfin.com", difficulty: "Hard", capabilities: ["scraper"] },
        ],
      },
      {
        name: "County & Assessor Records",
        sites: [
          { name: "County Assessor Sites", url: "https://www.county.org", difficulty: "Medium", capabilities: ["scraper", "form_filler"] },
          { name: "Trulia", url: "https://www.trulia.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "job-boards",
    name: "Job Boards & Careers",
    icon: "Briefcase",
    description: "Job postings, company profiles, and salary data",
    subcategories: [
      {
        name: "Major Job Boards",
        sites: [
          { name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs", difficulty: "Hard", capabilities: ["scraper", "form_filler", "ai_agent"] },
          { name: "Indeed", url: "https://www.indeed.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "Glassdoor", url: "https://www.glassdoor.com", difficulty: "Hard", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Niche & Remote",
        sites: [
          { name: "ZipRecruiter", url: "https://www.ziprecruiter.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "Remote.co", url: "https://remote.co", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
        ],
      },
    ],
  },
  {
    id: "social-media",
    name: "Social Media Platforms",
    icon: "Users",
    description: "Profiles, posts, engagement metrics, and business pages",
    subcategories: [
      {
        name: "Major Networks",
        sites: [
          { name: "Facebook", url: "https://www.facebook.com", difficulty: "Hard", capabilities: ["scraper", "ai_agent"] },
          { name: "Instagram", url: "https://www.instagram.com", difficulty: "Hard", capabilities: ["scraper"] },
          { name: "X (Twitter)", url: "https://www.x.com", difficulty: "Hard", capabilities: ["scraper", "clone_engine"] },
        ],
      },
      {
        name: "Video & Short-Form",
        sites: [
          { name: "TikTok", url: "https://www.tiktok.com", difficulty: "Hard", capabilities: ["scraper"] },
          { name: "YouTube", url: "https://www.youtube.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
        ],
      },
    ],
  },
  {
    id: "news-media",
    name: "News & Media",
    icon: "Newspaper",
    description: "Articles, headlines, RSS feeds, and breaking news",
    subcategories: [
      {
        name: "Major Outlets",
        sites: [
          { name: "CNN", url: "https://www.cnn.com", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
          { name: "BBC", url: "https://www.bbc.com", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
          { name: "Reuters", url: "https://www.reuters.com", difficulty: "Easy", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Tech & Industry",
        sites: [
          { name: "TechCrunch", url: "https://techcrunch.com", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
          { name: "The Verge", url: "https://www.theverge.com", difficulty: "Easy", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "business-directories",
    name: "Business Directories",
    icon: "Phone",
    description: "Business listings, contact info, reviews, and ratings",
    subcategories: [
      {
        name: "Local Search",
        sites: [
          { name: "Yelp", url: "https://www.yelp.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "Yellow Pages", url: "https://www.yellowpages.com", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
          { name: "BBB", url: "https://www.bbb.org", difficulty: "Easy", capabilities: ["scraper"] },
        ],
      },
      {
        name: "B2B Directories",
        sites: [
          { name: "Manta", url: "https://www.manta.com", difficulty: "Easy", capabilities: ["scraper"] },
          { name: "Kompass", url: "https://www.kompass.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "travel-hospitality",
    name: "Travel & Hospitality",
    icon: "Plane",
    description: "Hotel rates, flight prices, vacation rentals, and reviews",
    subcategories: [
      {
        name: "Hotels & Booking",
        sites: [
          { name: "Booking.com", url: "https://www.booking.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "Hotels.com", url: "https://www.hotels.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "Expedia", url: "https://www.expedia.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Vacation Rentals",
        sites: [
          { name: "Airbnb", url: "https://www.airbnb.com", difficulty: "Hard", capabilities: ["scraper", "clone_engine"] },
          { name: "VRBO", url: "https://www.vrbo.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "classifieds-auctions",
    name: "Classifieds & Auctions",
    icon: "Gavel",
    description: "Local listings, for-sale items, vehicles, and services",
    subcategories: [
      {
        name: "General Classifieds",
        sites: [
          { name: "Craigslist", url: "https://www.craigslist.org", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
          { name: "Gumtree", url: "https://www.gumtree.com", difficulty: "Easy", capabilities: ["scraper"] },
          { name: "OLX", url: "https://www.olx.com", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
        ],
      },
      {
        name: "Auctions",
        sites: [
          { name: "eBay Auctions", url: "https://www.ebay.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "GovPlanet", url: "https://www.govplanet.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "financial-data",
    name: "Financial & Stock Data",
    icon: "TrendingUp",
    description: "Stock prices, crypto rates, market news, and filings",
    subcategories: [
      {
        name: "Markets & Quotes",
        sites: [
          { name: "Yahoo Finance", url: "https://finance.yahoo.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "MarketWatch", url: "https://www.marketwatch.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "Bloomberg", url: "https://www.bloomberg.com", difficulty: "Hard", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Crypto",
        sites: [
          { name: "CoinMarketCap", url: "https://coinmarketcap.com", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
          { name: "CoinGecko", url: "https://www.coingecko.com", difficulty: "Easy", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "healthcare-medical",
    name: "Healthcare & Medical",
    icon: "HeartPulse",
    description: "Doctor profiles, hospital info, symptoms, and reviews",
    subcategories: [
      {
        name: "Provider Directories",
        sites: [
          { name: "Healthgrades", url: "https://www.healthgrades.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "Zocdoc", url: "https://www.zocdoc.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "WebMD", url: "https://www.webmd.com", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
        ],
      },
      {
        name: "Hospital Data",
        sites: [
          { name: "U.S. News Health", url: "https://health.usnews.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "education-courses",
    name: "Education & Courses",
    icon: "GraduationCap",
    description: "Online courses, university data, tutorials, and ratings",
    subcategories: [
      {
        name: "Course Platforms",
        sites: [
          { name: "Coursera", url: "https://www.coursera.org", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "Udemy", url: "https://www.udemy.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "edX", url: "https://www.edx.org", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Free Learning",
        sites: [
          { name: "Khan Academy", url: "https://www.khanacademy.org", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
          { name: "MIT OpenCourseWare", url: "https://ocw.mit.edu", difficulty: "Easy", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "government-records",
    name: "Government & Public Records",
    icon: "Landmark",
    description: "Property deeds, court records, vital stats, and permits",
    subcategories: [
      {
        name: "Property & Deeds",
        sites: [
          { name: "County Assessor Portals", url: "https://publicrecords.netronline.com", difficulty: "Medium", capabilities: ["scraper", "form_filler"] },
          { name: "State Land Records", url: "https://www.usa.gov/property-records", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Court & Vital Records",
        sites: [
          { name: "PACER", url: "https://pacer.uscourts.gov", difficulty: "Hard", capabilities: ["scraper", "form_filler"] },
          { name: "Vital Records", url: "https://www.cdc.gov/nchs/w2w/index.htm", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "automotive",
    name: "Automotive",
    icon: "Car",
    description: "Vehicle listings, specs, dealer inventory, and pricing",
    subcategories: [
      {
        name: "Vehicle Marketplaces",
        sites: [
          { name: "Cars.com", url: "https://www.cars.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "AutoTrader", url: "https://www.autotrader.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "CarGurus", url: "https://www.cargurus.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
        ],
      },
      {
        name: "Specs & Reviews",
        sites: [
          { name: "Edmunds", url: "https://www.edmunds.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "Kelley Blue Book", url: "https://www.kbb.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "food-delivery",
    name: "Food & Restaurant Delivery",
    icon: "UtensilsCrossed",
    description: "Restaurant menus, delivery options, ratings, and reviews",
    subcategories: [
      {
        name: "Delivery Platforms",
        sites: [
          { name: "DoorDash", url: "https://www.doordash.com", difficulty: "Hard", capabilities: ["scraper", "clone_engine"] },
          { name: "Uber Eats", url: "https://www.ubereats.com", difficulty: "Hard", capabilities: ["scraper"] },
          { name: "Grubhub", url: "https://www.grubhub.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
        ],
      },
      {
        name: "Restaurant Data",
        sites: [
          { name: "Yelp Restaurants", url: "https://www.yelp.com/collections/restaurants", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "OpenTable", url: "https://www.opentable.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "legal-records",
    name: "Legal & Court Records",
    icon: "Scale",
    description: "Case filings, dockets, judgments, and attorney profiles",
    subcategories: [
      {
        name: "Case Search",
        sites: [
          { name: "PACER", url: "https://pacer.uscourts.gov", difficulty: "Hard", capabilities: ["scraper", "form_filler"] },
          { name: "UniCourt", url: "https://unicourt.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Attorney Directories",
        sites: [
          { name: "Avvo", url: "https://www.avvo.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "Martindale", url: "https://www.martindale.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "people-search",
    name: "People Search & Public Info",
    icon: "Search",
    description: "Contact info, addresses, relatives, and background data",
    subcategories: [
      {
        name: "People Finders",
        sites: [
          { name: "Whitepages", url: "https://www.whitepages.com", difficulty: "Medium", capabilities: ["scraper", "ai_agent"] },
          { name: "Spokeo", url: "https://www.spokeo.com", difficulty: "Hard", capabilities: ["scraper"] },
          { name: "BeenVerified", url: "https://www.beenverified.com", difficulty: "Hard", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Reverse Lookup",
        sites: [
          { name: "TruePeopleSearch", url: "https://www.truepeoplesearch.com", difficulty: "Easy", capabilities: ["scraper"] },
          { name: "FastPeopleSearch", url: "https://www.fastpeoplesearch.com", difficulty: "Easy", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "sports-scores",
    name: "Sports & Scores",
    icon: "Trophy",
    description: "Live scores, stats, schedules, and player data",
    subcategories: [
      {
        name: "Major Sports",
        sites: [
          { name: "ESPN", url: "https://www.espn.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "CBS Sports", url: "https://www.cbssports.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Stats & Reference",
        sites: [
          { name: "Sports Reference", url: "https://www.sports-reference.com", difficulty: "Easy", capabilities: ["scraper"] },
          { name: "FlashScore", url: "https://www.flashscore.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "tech-directories",
    name: "Tech & Software Directories",
    icon: "Code",
    description: "Product listings, app reviews, repos, and SaaS catalogs",
    subcategories: [
      {
        name: "Product & SaaS",
        sites: [
          { name: "Product Hunt", url: "https://www.producthunt.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "G2", url: "https://www.g2.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "Capterra", url: "https://www.capterra.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
        ],
      },
      {
        name: "Code Repositories",
        sites: [
          { name: "GitHub", url: "https://github.com", difficulty: "Medium", capabilities: ["scraper", "ai_agent"] },
          { name: "GitLab", url: "https://gitlab.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "entertainment",
    name: "Entertainment & Streaming",
    icon: "Film",
    description: "Movie/TV data, ratings, cast info, and watch guides",
    subcategories: [
      {
        name: "Movie & TV Databases",
        sites: [
          { name: "IMDb", url: "https://www.imdb.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
          { name: "Rotten Tomatoes", url: "https://www.rottentomatoes.com", difficulty: "Medium", capabilities: ["scraper"] },
          { name: "TMDB", url: "https://www.themoviedb.org", difficulty: "Easy", capabilities: ["scraper", "clone_engine"] },
        ],
      },
      {
        name: "Streaming Catalogs",
        sites: [
          { name: "JustWatch", url: "https://www.justwatch.com", difficulty: "Easy", capabilities: ["scraper"] },
          { name: "Reelgood", url: "https://reelgood.com", difficulty: "Medium", capabilities: ["scraper"] },
        ],
      },
    ],
  },
  {
    id: "b2b-leads",
    name: "B2B Lead Generation",
    icon: "Building",
    description: "Company profiles, decision-makers, contact data, and enrichment",
    subcategories: [
      {
        name: "Lead Platforms",
        sites: [
          { name: "Apollo.io", url: "https://www.apollo.io", difficulty: "Hard", capabilities: ["scraper", "ai_agent", "form_filler"] },
          { name: "ZoomInfo", url: "https://www.zoominfo.com", difficulty: "Hard", capabilities: ["scraper"] },
        ],
      },
      {
        name: "Professional Networks",
        sites: [
          { name: "LinkedIn Sales Nav", url: "https://www.linkedin.com/sales", difficulty: "Hard", capabilities: ["scraper", "ai_agent"] },
          { name: "Crunchbase", url: "https://www.crunchbase.com", difficulty: "Medium", capabilities: ["scraper", "clone_engine"] },
        ],
      },
    ],
  },
];

export const difficultyStyles = {
  Easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const capabilityLabels = {
  scraper: "Scrape",
  clone_engine: "Clone",
  form_filler: "Form Auto",
  ai_agent: "AI Agent",
  captcha_solver: "Captcha",
  proxy_rotation: "Proxy",
};