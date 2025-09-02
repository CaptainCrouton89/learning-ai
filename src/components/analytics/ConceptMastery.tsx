'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ConceptMasteryData } from '@/lib/analytics';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Target, 
  TrendingUp,
  Brain,
  BookOpen
} from 'lucide-react';

interface ConceptMasteryProps {
  data: ConceptMasteryData[];
}

export function ConceptMastery({ data }: ConceptMasteryProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No concept progress data available yet.</p>
        <p className="text-sm mt-2">Start learning to see your progress here!</p>
      </div>
    );
  }

  // Sort concepts by progress percentage for better visualization
  const sortedData = [...data].sort((a, b) => b.progressPercentage - a.progressPercentage);

  return (
    <div className="space-y-6">
      {/* Overall Progress Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-primary">
            {data.filter(c => c.progressPercentage >= 80).length}
          </div>
          <div className="text-sm text-muted-foreground">Concepts Near Complete</div>
        </div>
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-yellow-600">
            {data.filter(c => c.progressPercentage >= 30 && c.progressPercentage < 80).length}
          </div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </div>
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-muted-foreground">
            {data.filter(c => c.progressPercentage < 30).length}
          </div>
          <div className="text-sm text-muted-foreground">Getting Started</div>
        </div>
      </div>

      <Separator />

      {/* Detailed Concept Breakdown */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center space-x-2">
          <Target className="h-4 w-4" />
          <span>Concept-by-Concept Progress</span>
        </h4>

        <div className="space-y-4">
          {sortedData.map((concept, index) => (
            <ConceptCard key={concept.conceptName} concept={concept} rank={index + 1} />
          ))}
        </div>
      </div>

      {/* Visual Progress Chart */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center space-x-2">
          <TrendingUp className="h-4 w-4" />
          <span>Progress Overview</span>
        </h4>

        <div className="space-y-3">
          {sortedData.map((concept) => (
            <div key={concept.conceptName} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium capitalize">
                  {concept.conceptName.replace('-', ' ')}
                </span>
                <span className="text-muted-foreground">
                  {concept.progressPercentage.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={concept.progressPercentage} 
                className="h-2"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ConceptCardProps {
  concept: ConceptMasteryData;
  rank: number;
}

function ConceptCard({ concept, rank }: ConceptCardProps) {
  const isComplete = concept.progressPercentage >= 80;
  const isInProgress = concept.progressPercentage >= 30 && concept.progressPercentage < 80;
  const isStarting = concept.progressPercentage < 30;

  const statusColor = isComplete 
    ? 'text-green-600' 
    : isInProgress 
    ? 'text-yellow-600' 
    : 'text-muted-foreground';

  const statusIcon = isComplete 
    ? <CheckCircle2 className="h-4 w-4" />
    : <Circle className="h-4 w-4" />;

  const lastActivity = new Date(concept.lastActivityTime);
  const timeSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-muted-foreground">
                #{rank}
              </span>
              <div className={statusColor}>
                {statusIcon}
              </div>
            </div>
            <div>
              <h3 className="font-semibold capitalize">
                {concept.conceptName.replace('-', ' ')}
              </h3>
              <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <BookOpen className="h-3 w-3" />
                  <span>{concept.totalItems + concept.totalTopics} items</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {timeSinceActivity === 0 
                      ? 'Today' 
                      : timeSinceActivity === 1 
                      ? 'Yesterday' 
                      : `${timeSinceActivity} days ago`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Badge variant={isComplete ? 'default' : isInProgress ? 'secondary' : 'outline'}>
            {concept.progressPercentage.toFixed(0)}% complete
          </Badge>
        </div>

        <div className="space-y-3">
          {/* Progress Bar */}
          <Progress value={concept.progressPercentage} className="h-2" />

          {/* Detailed Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Flashcards</span>
                <span className="font-medium">
                  {concept.masteredItems}/{concept.totalItems}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Topics</span>
                <span className="font-medium">
                  {concept.masteredTopics}/{concept.totalTopics}
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Comprehension</span>
                <div className="flex items-center space-x-1">
                  <span className="font-medium">
                    {concept.averageComprehension.toFixed(1)}/5
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {getComprehensionLevel(concept.averageComprehension)}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${statusColor}`}>
                  {getStatusText(concept.progressPercentage)}
                </span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {concept.progressPercentage < 80 && (
            <div className="mt-3 p-2 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground">
                💡 {getRecommendation(concept)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getComprehensionLevel(score: number): string {
  if (score >= 4.5) return 'Expert';
  if (score >= 4) return 'Advanced';
  if (score >= 3) return 'Good';
  if (score >= 2) return 'Basic';
  return 'Learning';
}

function getStatusText(progressPercentage: number): string {
  if (progressPercentage >= 80) return 'Near Complete';
  if (progressPercentage >= 50) return 'Good Progress';
  if (progressPercentage >= 30) return 'In Progress';
  if (progressPercentage >= 10) return 'Getting Started';
  return 'Just Beginning';
}

function getRecommendation(concept: ConceptMasteryData): string {
  if (concept.progressPercentage < 30) {
    return 'Focus on flashcard practice to build foundational knowledge';
  }
  
  if (concept.averageComprehension < 3) {
    return 'Review concept explanations to improve understanding';
  }
  
  if (concept.masteredItems < concept.totalItems * 0.7) {
    return 'Continue flashcard review to master remaining items';
  }
  
  if (concept.masteredTopics < concept.totalTopics * 0.7) {
    return 'Practice concept questions to deepen topic understanding';
  }
  
  return 'Great progress! Keep practicing to reach mastery';
}