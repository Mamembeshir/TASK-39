import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createArticle,
  getArticle,
  listManageArticles,
  publishArticle,
  rollbackArticle,
  saveArticleDraft,
  scheduleArticle,
} from '@/features/content/api/contentApi';
import { PageShell } from '@/shared/components/PageShell';
import { PageHeader } from '@/shared/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { AppLoader } from '@/shared/components/AppLoader';
import { toast } from 'sonner';

export function ContentStudioPage() {
  const articlesQuery = useQuery({ queryKey: ['content-manage'], queryFn: listManageArticles });
  const [selectedId, setSelectedId] = useState('');
  const articleQuery = useQuery({ queryKey: ['content-manage-detail', selectedId], queryFn: () => getArticle(selectedId), enabled: selectedId.length > 0 });

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [saving, setSaving] = useState(false);

  const articles = articlesQuery.data ?? [];
  const selectedArticle = articleQuery.data;
  const selectedVersionId = selectedArticle?.currentVersionId ?? selectedArticle?.publishedVersionId ?? null;

  useEffect(() => {
    if (selectedArticle) {
      setTitle(selectedArticle.title ?? '');
      setBody(selectedArticle.body ?? '');
      setSlug(selectedArticle.slug ?? '');
    }
  }, [selectedArticle]);

  async function refreshAll(targetId?: string) {
    await articlesQuery.refetch();
    if (targetId || selectedId) {
      const nextId = targetId ?? selectedId;
      setSelectedId(nextId);
      await articleQuery.refetch();
    }
  }

  async function handleCreate() {
    if (!slug.trim() || !title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const result = await createArticle({ slug: slug.trim(), title: title.trim(), body: body.trim() });
      toast.success('Draft created');
      await refreshAll(result.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await saveArticleDraft(selectedId, { title: title.trim(), body: body.trim() });
      toast.success('Draft saved');
      await refreshAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleSchedule() {
    if (!selectedId || !publishAt) return;
    setSaving(true);
    try {
      await scheduleArticle(selectedId, { publishAt: new Date(publishAt).toISOString(), versionId: selectedVersionId });
      toast.success('Publish scheduled');
      await refreshAll();
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await publishArticle(selectedId, { versionId: selectedVersionId });
      toast.success('Article published');
      await refreshAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleRollback(versionId: string) {
    if (!selectedId) return;
    setSaving(true);
    try {
      await rollbackArticle(selectedId, { versionId });
      toast.success('Rolled back to selected version');
      await refreshAll();
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <div className="grid gap-6">
        <PageHeader title="Content Studio" description="Create drafts, schedule publication, publish immediately, and roll back versions." />
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Content inventory</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {articlesQuery.isLoading && <AppLoader label="Loading content inventory..." />}
              {articles.map((article) => (
                <button key={article.id} type="button" className={selectedId === article.id ? 'rounded-xl border border-primary/40 bg-muted p-3 text-left' : 'rounded-xl border border-border bg-background p-3 text-left'} onClick={() => setSelectedId(article.id)}>
                  <p className="text-sm font-medium text-foreground">{article.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">/{article.slug} · {article.status ?? 'draft'}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{selectedId ? 'Edit article' : 'Create article'}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="article-slug" disabled={Boolean(selectedId)} />
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Article title" />
                </div>
                <textarea className="min-h-56 rounded-xl border border-border bg-background p-3" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the article body" />
                <div className="flex flex-wrap gap-2">
                  {!selectedId ? (
                    <Button onClick={handleCreate} disabled={saving || !slug.trim() || !title.trim() || !body.trim()}>{saving ? 'Saving...' : 'Create draft'}</Button>
                  ) : (
                    <>
                      <Button onClick={handleSaveDraft} disabled={saving || !title.trim() || !body.trim()}>{saving ? 'Saving...' : 'Save new draft version'}</Button>
                      <Button variant="secondary" onClick={handlePublish} disabled={saving}>Publish now</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {selectedId && (
              <Card>
                <CardHeader>
                  <CardTitle>Publishing controls</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2 sm:max-w-sm">
                    <Input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
                    <Button variant="secondary" onClick={handleSchedule} disabled={saving || !publishAt}>Schedule publish</Button>
                  </div>
                  <div className="grid gap-3">
                    <p className="text-sm font-medium text-foreground">Version history</p>
                    {(selectedArticle?.versions ?? []).map((version) => (
                      <div key={version.id} className="rounded-xl border border-border bg-background p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{version.title}</p>
                            <p className="text-xs text-muted-foreground">{version.createdAt ? new Date(version.createdAt).toLocaleString() : 'Draft version'}</p>
                          </div>
                          <Button variant="ghost" onClick={() => handleRollback(version.id)} disabled={saving || version.id === selectedArticle?.publishedVersionId}>Rollback to this version</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
