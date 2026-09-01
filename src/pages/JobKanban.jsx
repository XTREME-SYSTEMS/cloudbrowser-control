import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, RefreshCw } from "lucide-react";

const COLUMNS = [
  { id: "queued", label: "Queued", color: "bg-slate-100 dark:bg-slate-800" },
  { id: "running", label: "Running", color: "bg-blue-100 dark:bg-blue-900/30" },
  { id: "retrying", label: "Retrying", color: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "completed", label: "Completed", color: "bg-green-100 dark:bg-green-900/30" },
  { id: "failed", label: "Failed", color: "bg-red-100 dark:bg-red-900/30" },
  { id: "cancelled", label: "Cancelled", color: "bg-zinc-100 dark:bg-zinc-800" },
];

export default function JobKanban() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Job.list("-updated_date", 100);
      setJobs(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadJobs(); }, []);

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const jobId = result.draggableId;
    const newStatus = result.destination.droppableId;
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
    try {
      await base44.entities.Job.update(jobId, { status: newStatus });
    } catch (e) {
      // Revert on failure
      loadJobs();
    }
  };

  const jobsByStatus = (status) => jobs.filter(j => j.status === status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Job Board</h1>
          <p className="text-sm text-muted-foreground">Drag jobs between columns to update status</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
            {COLUMNS.map((col) => {
              const colJobs = jobsByStatus(col.id);
              return (
                <div key={col.id} className="flex-shrink-0 w-72">
                  <div className={`rounded-lg ${col.color} p-3 mb-2`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{col.label}</span>
                      <span className="text-xs bg-background px-2 py-0.5 rounded-full">{colJobs.length}</span>
                    </div>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 min-h-[200px] rounded-lg p-2 transition-colors ${snapshot.isDraggingOver ? "bg-accent" : ""}`}
                      >
                        {colJobs.map((job, index) => (
                          <Draggable key={job.id} draggableId={job.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-grab ${snapshot.isDragging ? "opacity-70" : ""}`}
                              >
                                <Card
                                  className="hover:shadow-md transition-shadow cursor-pointer"
                                  onClick={() => navigate(`/jobs/${job.id}`)}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-2">
                                      <Briefcase className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{job.name}</p>
                                        {job.start_url && (
                                          <p className="text-xs text-muted-foreground truncate mt-0.5">{job.start_url}</p>
                                        )}
                                        {job.retry_count > 0 && (
                                          <span className="text-xs text-amber-600 mt-1 inline-block">
                                            {job.retry_count} retries
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colJobs.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">Drop jobs here</p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}