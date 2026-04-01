const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");

const IDS = {
  users: {
    customer: new ObjectId("65f000000000000000000001"),
    administrator: new ObjectId("65f000000000000000000002"),
    serviceManager: new ObjectId("65f000000000000000000003"),
    moderator: new ObjectId("65f000000000000000000004"),
  },
  services: {
    deepCleaning: new ObjectId("65f000000000000000000101"),
    handymanVisit: new ObjectId("65f000000000000000000102"),
    seniorSupport: new ObjectId("65f000000000000000000103"),
    mealPrepAssist: new ObjectId("65f000000000000000000104"),
  },
  bundles: {
    homeRefresh: new ObjectId("65f000000000000000000201"),
  },
  slots: {
    first: new ObjectId("65f000000000000000000301"),
    second: new ObjectId("65f000000000000000000302"),
  },
  orders: {
    first: new ObjectId("65f000000000000000000401"),
  },
  reviews: {
    first: new ObjectId("65f000000000000000000501"),
  },
  tickets: {
    first: new ObjectId("65f000000000000000000601"),
  },
  messages: {
    first: new ObjectId("65f000000000000000000701"),
  },
  content: {
    first: new ObjectId("65f000000000000000000801"),
    version1: new ObjectId("65f000000000000000000811"),
    version2: new ObjectId("65f000000000000000000812"),
  },
  media: {
    first: new ObjectId("65f000000000000000000901"),
  },
  audit: {
    first: new ObjectId("65f000000000000000000a01"),
  },
  settings: {
    organization: new ObjectId("65f000000000000000000b01"),
  },
};

function seededUsers(now) {
  const defaultHash = bcrypt.hashSync("devpass123456", 10);
  return [
    {
      _id: IDS.users.customer,
      username: "customer_demo",
      passwordHash: defaultHash,
      roles: ["customer"],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: IDS.users.administrator,
      username: "admin_demo",
      passwordHash: defaultHash,
      roles: ["administrator"],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: IDS.users.serviceManager,
      username: "manager_demo",
      passwordHash: defaultHash,
      roles: ["service_manager"],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: IDS.users.moderator,
      username: "moderator_demo",
      passwordHash: defaultHash,
      roles: ["moderator"],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function seededServices(now) {
  return [
    {
      _id: IDS.services.deepCleaning,
      title: "Deep Cleaning",
      description: "Top-to-bottom residential cleaning service.",
      category: "home_cleaning",
      tags: ["deep", "weekend", "priority"],
      published: true,
      specDefinitions: {
        durationMinutes: [30, 60, 90],
        headcount: [1, 2, 3, 4],
        toolsMode: ["provider", "customer"],
      },
      pricing: {
        basePrice: 80,
        durationAdjustments: {
          30: 0,
          60: 45,
          90: 90,
        },
      },
      addOns: ["inside_fridge", "inside_oven", "window_focus"],
      bundleIds: [IDS.bundles.homeRefresh],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: IDS.services.handymanVisit,
      title: "Handyman Visit",
      description: "Basic repairs and fixture installation.",
      category: "home_maintenance",
      tags: ["priority", "repair", "weekend"],
      published: true,
      specDefinitions: {
        durationMinutes: [30, 60, 90],
        headcount: [1, 2],
        toolsMode: ["provider", "customer"],
      },
      pricing: {
        basePrice: 70,
        durationAdjustments: {
          30: 0,
          60: 40,
          90: 85,
        },
      },
      addOns: ["materials_pickup", "ladder_required"],
      bundleIds: [IDS.bundles.homeRefresh],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: IDS.services.seniorSupport,
      title: "Senior Support Check-in",
      description: "Companionship and light assistance visit.",
      category: "care_support",
      tags: ["care", "recurring", "priority"],
      published: true,
      specDefinitions: {
        durationMinutes: [30, 60, 90],
        headcount: [1, 2],
        toolsMode: ["provider", "customer"],
      },
      pricing: {
        basePrice: 60,
        durationAdjustments: {
          30: 0,
          60: 35,
          90: 75,
        },
      },
      addOns: ["medication_reminder", "grocery_trip"],
      bundleIds: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: IDS.services.mealPrepAssist,
      title: "Meal Prep Assistance",
      description: "Meal prep support for weekly plans.",
      category: "care_support",
      tags: ["care", "nutrition", "weekend"],
      published: true,
      specDefinitions: {
        durationMinutes: [30, 60, 90],
        headcount: [1, 2, 3],
        toolsMode: ["provider", "customer"],
      },
      pricing: {
        basePrice: 55,
        durationAdjustments: {
          30: 0,
          60: 30,
          90: 65,
        },
      },
      addOns: ["dietary_plan", "pantry_organize"],
      bundleIds: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function seededCapacitySlots(now) {
  const slotIds = [
    "65f000000000000000003100",
    "65f000000000000000003101",
    "65f000000000000000003102",
    "65f000000000000000003103",
    "65f000000000000000003104",
    "65f000000000000000003105",
    "65f000000000000000003106",
  ];
  const slots = [];
  const baseDate = new Date(now);
  baseDate.setUTCHours(9, 0, 0, 0);

  for (let day = 0; day < 7; day += 1) {
    const start = new Date(baseDate);
    start.setUTCDate(baseDate.getUTCDate() + day);
    slots.push({
      _id: new ObjectId(slotIds[day]),
      serviceId: day % 2 === 0 ? IDS.services.deepCleaning : IDS.services.seniorSupport,
      startTime: start,
      remainingCapacity: day % 4,
      createdAt: now,
      updatedAt: now,
    });
  }

  return slots;
}

async function upsertById(collection, docs) {
  await Promise.all(
    docs.map((doc) => {
      const normalizedCreatedAt = doc.createdAt || new Date();
      const { createdAt, ...rest } = doc;
      return collection.updateOne(
        { _id: doc._id },
        {
          $set: { ...rest, updatedAt: doc.updatedAt || new Date() },
          $setOnInsert: { createdAt: normalizedCreatedAt },
        },
        { upsert: true },
      );
    }),
  );
}

async function seedDatabase(database) {
  const now = new Date();

  await upsertById(database.collection("users"), seededUsers(now));
  await upsertById(database.collection("services"), seededServices(now));

  await upsertById(database.collection("bundles"), [
    {
      _id: IDS.bundles.homeRefresh,
      title: "Home Refresh Pack",
      description: "Deep cleaning + handyman starter package.",
      serviceIds: [IDS.services.deepCleaning, IDS.services.handymanVisit],
      pricing: {
        discountPercent: 0.1,
      },
      published: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("service_questions"), [
    {
      _id: new ObjectId("65f000000000000000000c01"),
      serviceId: IDS.services.deepCleaning,
      question: "Are eco-friendly products available?",
      answer: "Yes, eco-friendly supplies can be requested at booking.",
      status: "published",
      createdBy: IDS.users.serviceManager,
      answeredBy: IDS.users.administrator,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("travel_zones"), [
    {
      _id: "default",
      bands: [
        { minMiles: 0, maxMiles: 10, behavior: "allowed" },
        { minMiles: 10, maxMiles: 20, behavior: "allowed" },
        { minMiles: 20, maxMiles: null, behavior: "blocked" },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("jurisdictions"), [
    {
      _id: "US-CA-SF",
      taxRequired: true,
      taxRate: 0.0875,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "US-OR-PDX",
      taxRequired: false,
      taxRate: 0,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("capacity_slots"), seededCapacitySlots(now));

  await upsertById(database.collection("orders"), [
    {
      _id: IDS.orders.first,
      customerId: IDS.users.customer,
      state: "pending_confirmation",
      lineItems: [
        {
          type: "service",
          serviceId: IDS.services.deepCleaning,
          spec: { durationMinutes: 60, headcount: 2, toolsMode: "provider" },
          quantity: 1,
        },
        {
          type: "bundle",
          bundleId: IDS.bundles.homeRefresh,
          quantity: 1,
        },
      ],
      slotIds: [new ObjectId("65f000000000000000003100")],
      pricingSnapshot: {
        subtotal: 220,
        tax: 19.25,
        total: 239.25,
        currency: "USD",
      },
      quoteId: null,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("reviews"), [
    {
      _id: IDS.reviews.first,
      orderId: IDS.orders.first,
      serviceIds: [IDS.services.deepCleaning],
      verified: true,
      status: "approved",
      text: "Great service and very professional.",
      rating: 5,
      tags: ["punctual", "thorough"],
      mediaIds: [IDS.media.first],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("tickets"), [
    {
      _id: IDS.tickets.first,
      orderId: IDS.orders.first,
      category: "billing",
      status: "waiting_on_customer",
      legalHold: false,
      cleanedAt: null,
      sla: {
        resolutionDueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        firstResponseDueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        isPaused: true,
        pausedAt: now,
      },
      immutableOutcome: null,
      attachmentIds: [IDS.media.first],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("messages"), [
    {
      _id: IDS.messages.first,
      type: "announcement",
      title: "Welcome to HomeCareOps",
      body: "Platform seed announcement.",
      publishAt: now,
      roleTargets: ["customer", "administrator", "service_manager", "moderator"],
      readByUserIds: [IDS.users.administrator],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("content_versions"), [
    {
      _id: IDS.content.first,
      slug: "getting-started",
      status: "published",
      currentVersionId: IDS.content.version2,
      publishedVersionId: IDS.content.version2,
      versions: [
        {
          id: IDS.content.version1,
          title: "Getting Started",
          body: "Initial draft",
          mediaIds: [],
          createdAt: now,
        },
        {
          id: IDS.content.version2,
          title: "Getting Started",
          body: "Updated draft",
          mediaIds: [],
          createdAt: now,
        },
      ],
      scheduledPublishAt: null,
      scheduledVersionId: null,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("media_metadata"), [
    {
      _id: IDS.media.first,
      sha256: "d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2",
      byteSize: 128000,
      mime: "image/jpeg",
      refCount: 2,
      purpose: "review",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("audit_logs"), [
    {
      _id: IDS.audit.first,
      who: IDS.users.administrator,
      action: "seed.bootstrap",
      when: now,
      metadata: { source: "api_startup" },
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await upsertById(database.collection("settings"), [
    {
      _id: IDS.settings.organization,
      organizationTimezone: "America/Los_Angeles",
      businessHours: {
        monday: { start: "09:00", end: "17:00" },
        tuesday: { start: "09:00", end: "17:00" },
        wednesday: { start: "09:00", end: "17:00" },
        thursday: { start: "09:00", end: "17:00" },
        friday: { start: "09:00", end: "17:00" },
      },
      pendingConfirmationTimeoutMinutes: 15,
      sensitiveTerms: ["scam", "abuse", "fraud"],
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

module.exports = {
  seedDatabase,
};
