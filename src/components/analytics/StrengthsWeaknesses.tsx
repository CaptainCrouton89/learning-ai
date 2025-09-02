'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { StrengthWeaknessData } from '@/lib/analytics';
import { 
  TrendingUp, 
  TrendingDown, 
  Star, 
  AlertTriangle, 
  CheckCircle2,
  Target,
  Brain,
  Lightbulb,
  Trophy
} from 'lucide-react';

interface StrengthsWeaknessesProps {
  data: StrengthWeaknessData;
}

export function StrengthsWeaknesses({ data }: StrengthsWeaknessesProps) {
  const { strengths, weaknesses, topPerformingConcepts, strugglingConcepts } = data;

  if (!data || (!strengths.length && !weaknesses.length && !topPerformingConcepts.length && !strugglingConcepts.length)) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Not enough learning data yet.</p>
        <p className="text-sm mt-2">Complete more activities to see your performance analysis!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Overview */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center space-x-1">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-lg font-semibold text-green-600">
              {strengths.length}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">Strong Areas</div>
        </div>
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center space-x-1">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-lg font-semibold text-orange-600">
              {weaknesses.length}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">Areas to Improve</div>
        </div>
      </div>

      <Separator />

      {/* Top Performing Concepts */}
      {topPerformingConcepts.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center space-x-2 text-green-600">
            <Trophy className="h-4 w-4" />
            <span>Top Performing Concepts</span>
          </h4>
          <div className="space-y-2">
            {topPerformingConcepts.slice(0, 3).map((concept, index) => (
              <div key={concept.concept} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                    #{index + 1}
                  </Badge>
                  <span className="font-medium capitalize">
                    {concept.concept.replace('-', ' ')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {concept.masteryPercentage.toFixed(0)}% mastery
                  </span>
                  <Badge variant="default" className="text-xs">
                    {concept.averageScore.toFixed(1)}/5
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Struggling Concepts */}
      {strugglingConcepts.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center space-x-2 text-orange-600">
            <Target className="h-4 w-4" />
            <span>Focus Areas</span>
          </h4>
          <div className="space-y-3">
            {strugglingConcepts.slice(0, 3).map((concept, index) => (
              <Card key={concept.concept} className="border-orange-200 dark:border-orange-800">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="font-medium capitalize">
                        {concept.concept.replace('-', ' ')}
                      </span>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {concept.averageScore.toFixed(1)}/5
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <Progress 
                      value={concept.masteryPercentage} 
                      className="h-1" 
                    />
                    
                    {concept.recommendedActions.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1">
                          <Lightbulb className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs font-medium text-muted-foreground">
                            Recommendations:
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {concept.recommendedActions.map((action, actionIndex) => (
                            <li key={actionIndex} className="text-xs text-muted-foreground pl-2">
                              • {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Detailed Strengths and Weaknesses */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Strengths */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center space-x-2 text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span>Your Strengths</span>
            {strengths.length > 0 && (
              <Badge variant="outline" className="text-xs text-green-600">
                {strengths.length} items
              </Badge>
            )}
          </h4>
          
          {strengths.length > 0 ? (
            <ScrollArea className="h-60">
              <div className="space-y-2 pr-4">
                {strengths.map((strength, index) => (
                  <div key={`${strength.concept}-${strength.item}`} className="p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm capitalize">
                        {strength.item.replace('-', ' ')}
                      </span>
                      <Badge variant="default" className="text-xs">
                        {strength.averageScore.toFixed(1)}/5
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="capitalize">{strength.concept.replace('-', ' ')}</span>
                      <span>{strength.attempts} attempts</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No standout strengths identified yet.</p>
              <p className="text-xs mt-1">Keep practicing to build mastery!</p>
            </div>
          )}
        </div>

        {/* Weaknesses */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center space-x-2 text-orange-600">
            <TrendingDown className="h-4 w-4" />
            <span>Areas to Improve</span>
            {weaknesses.length > 0 && (
              <Badge variant="outline" className="text-xs text-orange-600">
                {weaknesses.length} items
              </Badge>
            )}
          </h4>
          
          {weaknesses.length > 0 ? (
            <ScrollArea className="h-60">
              <div className="space-y-2 pr-4">
                {weaknesses.map((weakness, index) => (
                  <div key={`${weakness.concept}-${weakness.item}`} className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded-md border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm capitalize">
                        {weakness.item.replace('-', ' ')}
                      </span>
                      <Badge variant="destructive" className="text-xs">
                        {weakness.averageScore.toFixed(1)}/5
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="capitalize">{weakness.concept.replace('-', ' ')}</span>
                      <span>{weakness.attempts} attempts</span>
                    </div>
                    <div className="text-xs text-orange-600">
                      <span className="font-medium">Issue: </span>
                      {weakness.strugglingArea}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No significant weaknesses found.</p>
              <p className="text-xs mt-1">Great progress across all areas!</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Items */}
      {(weaknesses.length > 0 || strugglingConcepts.length > 0) && (
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center space-x-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <span>Recommended Actions</span>
          </h4>
          
          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-4">
              <ul className="space-y-2 text-sm">
                {weaknesses.length > 0 && (
                  <li className="flex items-start space-x-2">
                    <span className="text-yellow-600 mt-0.5">•</span>
                    <span>
                      Focus extra practice on <strong>{weaknesses.length}</strong> struggling items, 
                      especially those with fundamental understanding issues.
                    </span>
                  </li>
                )}
                
                {strugglingConcepts.length > 0 && (
                  <li className="flex items-start space-x-2">
                    <span className="text-yellow-600 mt-0.5">•</span>
                    <span>
                      Prioritize review of <strong>{strugglingConcepts.length}</strong> challenging concepts 
                      to improve overall comprehension.
                    </span>
                  </li>
                )}
                
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>
                    Use your strong areas ({strengths.length} identified) as building blocks 
                    to tackle more difficult topics.
                  </span>
                </li>
                
                <li className="flex items-start space-x-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>
                    Consider spaced repetition for items you're struggling with to improve 
                    long-term retention.
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}