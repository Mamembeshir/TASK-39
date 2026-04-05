function buildSearchText(parts = []) {
  return parts.filter(Boolean).join(" ");
}

async function rebuildSearchDocuments(database) {
  const now = new Date();
  const docs = [];

  const services = await database.collection("services").find({ published: true }).toArray();
  for (const service of services) {
    docs.push({
      type: "service",
      sourceId: service._id,
      title: service.title,
      body: service.description,
      tags: service.tags || [],
      searchText: buildSearchText([service.title, service.description, ...(service.tags || [])]),
      publishAt: service.updatedAt || now,
      createdAt: now,
      updatedAt: now,
    });
  }

  const contents = await database
    .collection("content_versions")
    .find({ status: "published", publishedVersionId: { $ne: null } })
    .toArray();

  for (const content of contents) {
    const published = (content.versions || []).find(
      (version) => version.id && version.id.toString() === content.publishedVersionId.toString(),
    );
    if (!published) {
      continue;
    }

    docs.push({
      type: "content",
      sourceId: content._id,
      title: published.title,
      body: published.body,
      tags: [content.slug],
      searchText: buildSearchText([content.slug, published.title, published.body]),
      publishAt: content.publishedAt || now,
      createdAt: now,
      updatedAt: now,
    });
  }

  await database.collection("search_documents").deleteMany({});
  if (docs.length > 0) {
    await database.collection("search_documents").insertMany(docs);
  }
}

module.exports = {
  rebuildSearchDocuments,
};
