async function ensureIndexes(database) {
  async function dropIndexIfExists(collectionName, indexName) {
    try {
      await database.collection(collectionName).dropIndex(indexName);
    } catch (error) {
      if (error.codeName !== "IndexNotFound" && error.codeName !== "NamespaceNotFound") {
        throw error;
      }
    }
  }

  await database.collection("users").createIndex({ username: 1 }, { unique: true, name: "uniq_username" });

  await dropIndexIfExists("reviews", "uniq_published_review_per_order");

  await database.collection("reviews").createIndex({ orderId: 1 }, { unique: true, name: "uniq_review_per_order" });

  await database.collection("services").createIndex({ category: 1 }, { name: "idx_services_category" });
  await database.collection("services").createIndex({ tags: 1 }, { name: "idx_services_tags" });
  await database.collection("services").createIndex({ published: 1 }, { name: "idx_services_published" });
  await database.collection("bundles").createIndex({ published: 1 }, { name: "idx_bundles_published" });
  await database
    .collection("service_questions")
    .createIndex({ serviceId: 1, status: 1 }, { name: "idx_service_questions" });
  await database
    .collection("favorites")
    .createIndex({ userId: 1, serviceId: 1 }, { unique: true, name: "uniq_favorite_per_user_service" });
  await database
    .collection("compare_lists")
    .createIndex({ userId: 1 }, { unique: true, name: "uniq_compare_per_user" });
  await dropIndexIfExists("media_metadata", "uniq_media_sha256");
  await dropIndexIfExists("media_metadata", "uniq_media_scope_sha256");
  await database
    .collection("media_metadata")
    .createIndex({ dedupNamespace: 1, sha256: 1 }, { unique: true, name: "uniq_media_namespace_sha256" });
  await database.collection("content_versions").createIndex({ slug: 1 }, { unique: true, name: "uniq_content_slug" });
  await database
    .collection("services")
    .createIndex({ title: "text", description: "text", tags: "text" }, { name: "txt_services_catalog" });
  await database
    .collection("content_versions")
    .createIndex(
      { slug: "text", "versions.title": "text", "versions.body": "text" },
      { name: "txt_content_versions" },
    );
  await dropIndexIfExists("content_versions", "idx_content_media_refs");
  await dropIndexIfExists("content_versions", "idx_content_version_media_refs");
  await database.collection("content_versions").createIndex({ mediaRefs: 1 }, { name: "idx_content_media_refs" });
  await database
    .collection("content_versions")
    .createIndex({ "versions.mediaRefs": 1 }, { name: "idx_content_version_media_refs" });
  await database
    .collection("content_versions")
    .createIndex({ status: 1, scheduledPublishAt: 1 }, { name: "idx_content_scheduled_publish_due" });
  await database
    .collection("search_documents")
    .createIndex({ type: 1, sourceId: 1 }, { unique: true, name: "uniq_search_doc" });
  await database.collection("search_documents").createIndex({ searchText: "text" }, { name: "txt_search_documents" });
  await database.collection("search_documents").createIndex({ publishAt: 1 }, { name: "idx_search_publish_at" });
  await database
    .collection("blacklists")
    .createIndex({ type: 1, value: 1 }, { unique: true, name: "uniq_blacklist_entry" });

  await database
    .collection("refresh_tokens")
    .createIndex({ tokenHash: 1 }, { unique: true, name: "uniq_refresh_token_hash" });
  await database
    .collection("refresh_tokens")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ttl_refresh_tokens" });
  await database
    .collection("auth_rate_limits")
    .createIndex({ key: 1, windowStart: 1 }, { unique: true, name: "uniq_auth_rate_limit_window" });
  await database
    .collection("auth_rate_limits")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "ttl_auth_rate_limits" });
  await database
    .collection("user_devices")
    .createIndex({ userId: 1, deviceHash: 1 }, { unique: true, name: "uniq_user_device" });
  await database.collection("audit_logs").createIndex({ action: 1, when: -1 }, { name: "idx_audit_action_when" });
  await database
    .collection("audit_logs")
    .createIndex(
      { "metadata.isNewDevice": 1, "metadata.risk.category": 1, when: -1 },
      { name: "idx_audit_new_device_risk" },
    );
}

module.exports = {
  ensureIndexes,
};
