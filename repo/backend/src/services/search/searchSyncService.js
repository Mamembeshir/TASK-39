function createSearchSyncService({ getDatabase }) {
  return {
    syncServiceSearchDocument: async (serviceId) => {
      const database = getDatabase();
      const service = await database.collection("services").findOne({ _id: serviceId });
      if (!service || !service.published) {
        await database.collection("search_documents").deleteOne({ type: "service", sourceId: serviceId });
        return;
      }

      const now = new Date();
      await database.collection("search_documents").updateOne(
        { type: "service", sourceId: serviceId },
        {
          $set: {
            title: service.title,
            body: service.description,
            tags: service.tags || [],
            searchText: [service.title, service.description, ...(service.tags || [])]
              .filter(Boolean)
              .join(" "),
            publishAt: service.updatedAt || now,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );
    },

    syncContentSearchDocument: async (contentId) => {
      const database = getDatabase();
      const content = await database.collection("content_versions").findOne({ _id: contentId });
      if (!content || content.status !== "published" || !content.publishedVersionId) {
        await database.collection("search_documents").deleteOne({ type: "content", sourceId: contentId });
        return;
      }

      const published = (content.versions || []).find(
        (version) => version.id && version.id.toString() === content.publishedVersionId.toString(),
      );
      if (!published) {
        await database.collection("search_documents").deleteOne({ type: "content", sourceId: contentId });
        return;
      }

      const now = new Date();
      await database.collection("search_documents").updateOne(
        { type: "content", sourceId: contentId },
        {
          $set: {
            title: published.title,
            body: published.body,
            tags: [content.slug],
            searchText: [content.slug, published.title, published.body].filter(Boolean).join(" "),
            publishAt: content.publishedAt || now,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true },
      );
    },
  };
}

module.exports = {
  createSearchSyncService,
};
