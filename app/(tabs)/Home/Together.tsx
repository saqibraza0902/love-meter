import ScreenBackButton from '@/components/ScreenBackButton';
import { useAppSelector } from '@/hooks/use-redux';
import { useLocalSearchParams, useRouter } from '@/navigation/router-compat';
import { useToast } from '@/providers/toast-provider';
import * as ImagePicker from '@/utils/image-picker-compat';
import { getMediaUrl, supabase, uploadImage } from '@/utils/supabase';
import {
  addDays,
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
} from 'date-fns';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

type StatusRow = {
  id: string;
  couple_id: string;
  user_id: string;
  body: string;
  updated_at: string;
};
type EventRow = {
  id: string;
  title: string;
  details: string;
  event_kind: string;
  starts_at: string;
  link_url?: string | null;
};
type GoalRow = {
  id: string;
  title: string;
  details: string;
  target_date: string | null;
  completed_at: string | null;
};
type NoteRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  link_url: string | null;
  pinned: boolean;
};
type PeriodRow = {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string | null;
  period_start_at?: string | null;
  period_end_at?: string | null;
  note: string;
};
type DailySnap = {
  id: string;
  user_id: string;
  checkin_date: string;
  status_text: string;
  image_path: string;
  image: string;
  created_at: string;
  expires_at: string;
};
type StreakDay = { user_id: string; checkin_date: string };
type LinkRow = {
  id: string;
  title: string;
  url: string;
  kind: string;
  created_at: string;
};
type SketchPoint = { x: number; y: number };
type SketchStroke = { id: string; color: string; points: SketchPoint[] };
type ModalKind = 'status' | 'snap' | 'event' | 'goal' | 'note' | 'link' | null;
type CycleDatePickerKind = 'start' | 'end' | null;

const STATUS_PRESETS = [
  'Working right now',
  'On a break',
  'Doing my own thing, quiet company welcome',
  'Could use a little company',
  'Free for a call',
];
const DAILY_CONNECTION_PROMPTS = [
  'Whatâ€™s one tiny thing that made today easier?',
  'If I could teleport to you for an hour, what should we do?',
  'What are you looking forward to this week?',
  'What kind of company would feel good tonight?',
  'Whatâ€™s something you want us to remember about this season?',
  'What song matches your mood today?',
  'Whatâ€™s one little way I can support you tomorrow?',
];
const NOTE_CATEGORIES = ['note', 'immigration', 'checklist'] as const;

function currentStreak(days: string[]) {
  const sorted = [...new Set(days)].sort((left, right) =>
    right.localeCompare(left),
  );
  if (!sorted.length) return 0;
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T00:00:00Z`).valueOf();
    const current = new Date(`${sorted[index]}T00:00:00Z`).valueOf();
    if (previous - current !== 86400000) break;
    streak += 1;
  }
  return streak;
}

function localTime(timeZone?: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timeZone || undefined,
    }).format(new Date());
  } catch {
    return format(new Date(), 'h:mm a');
  }
}

function eventDateLabel(value: string) {
  const date = new Date(value);
  return `${
    isToday(date)
      ? 'Today'
      : isTomorrow(date)
      ? 'Tomorrow'
      : format(date, 'EEE, d MMM')
  } Â· ${format(date, 'h:mm a')}`;
}

function dateAtNoon(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function cycleDateRange(start: string | null, end: string | null) {
  if (!start) return 'Needs more logged dates';
  if (!end) return `From ${format(dateAtNoon(start), 'd MMM')}`;
  if (start > end) return 'Not estimated for this cycle';
  const first = dateAtNoon(start);
  const last = dateAtNoon(end);
  if (start === end) return format(first, 'd MMM');
  return format(first, 'MMM yyyy') === format(last, 'MMM yyyy')
    ? `${format(first, 'd')}–${format(last, 'd MMM')}`
    : `${format(first, 'd MMM')}–${format(last, 'd MMM')}`;
}

function dateTimeInZone(dateText: string, timeText: string, timeZone: string) {
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute] = timeText.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let instant = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(
      parts.map(part => [part.type, part.value]),
    );
    const represented = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    instant += desired - represented;
  }
  return new Date(instant);
}

function calendarDateInZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function getCycleInsights(rows: PeriodRow[]) {
  const ordered = [...rows].sort((a, b) => a.period_start.localeCompare(b.period_start));
  const intervals = ordered.slice(1).map((row, index) =>
    differenceInCalendarDays(dateAtNoon(row.period_start), dateAtNoon(ordered[index].period_start)),
  ).filter(days => days >= 15 && days <= 60).slice(-6);
  const periodDays = ordered.filter(row => row.period_end).map(row =>
    differenceInCalendarDays(dateAtNoon(row.period_end!), dateAtNoon(row.period_start)) + 1,
  ).filter(days => days >= 1 && days <= 15).slice(-6);
  const averageCycleDays = median(intervals);
  const averagePeriodDays = median(periodDays);
  const latest = ordered[ordered.length - 1];
  const latestStart = latest?.period_start_at
    ? new Date(latest.period_start_at)
    : latest ? dateAtNoon(latest.period_start) : null;
  const nextStart = latestStart && averageCycleDays
    ? format(addDays(latestStart, averageCycleDays), 'yyyy-MM-dd')
    : null;
  const deviations = averageCycleDays
    ? intervals.map(days => Math.abs(days - averageCycleDays))
    : [];
  const estimateMarginDays = deviations.length
    ? Math.min(7, Math.max(2, median(deviations) || 2))
    : 3;
  return { ordered, intervals, averageCycleDays, averagePeriodDays, latest, latestStart, nextStart, estimateMarginDays };
}

function cyclePhaseForDate(start: string, periodEnd: string | null, nextStart: string | null, date: string) {
  const elapsed = differenceInCalendarDays(dateAtNoon(date), dateAtNoon(start));
  if (elapsed < 0) return null;
  const day = elapsed + 1;
  if (periodEnd && date <= periodEnd) return { day, phase: 'Period' };
  if (!periodEnd && day === 1) return { day, phase: 'Period' };
  if (!nextStart) return { day, phase: 'Tracking' };
  if (date >= nextStart) return { day, phase: 'Period may be due' };
  const ovulationWindowStart = format(addDays(dateAtNoon(nextStart), -16), 'yyyy-MM-dd');
  const ovulationWindowEnd = format(addDays(dateAtNoon(nextStart), -10), 'yyyy-MM-dd');
  if (date < ovulationWindowStart) return { day, phase: 'Follicular estimate' };
  if (date <= ovulationWindowEnd) return { day, phase: 'Ovulation window estimate' };
  return { day, phase: 'Luteal estimate' };
}

const TogetherScreen = ({
  sectionOverride,
}: { sectionOverride?: string } = {}) => {
  const router = useRouter();
  const { section: routeSection } = useLocalSearchParams<{
    section?: string;
  }>();
  const section = sectionOverride || routeSection;
  const { user, partner } = useAppSelector(state => state.user);
  const { toast } = useToast();
  const coupleId = user?.coupleId;
  const isHub = !section;
  const showConnection = section === 'connection';
  const showPlanning = section === 'planning';
  const showNotes = section === 'notes';
  const showPlay = section === 'play';
  const showCycle = section === 'cycle';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [dailySnaps, setDailySnaps] = useState<DailySnap[]>([]);
  const dailySnapsRef = useRef<DailySnap[]>([]);
  const [streakDays, setStreakDays] = useState<StreakDay[]>([]);
  const [snapImage, setSnapImage] = useState<string | null>(null);
  const [openSnap, setOpenSnap] = useState<DailySnap | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [strokes, setStrokes] = useState<SketchStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<SketchPoint[]>([]);
  const [inkColor, setInkColor] = useState('#a65f65');
  const [boardSize, setBoardSize] = useState({ width: 1, height: 1 });
  const activeStrokeRef = useRef<SketchPoint[]>([]);
  const [sharePeriods, setSharePeriods] = useState(false);
  const [partnerSharesPeriods, setPartnerSharesPeriods] = useState(false);
  const [periodOwnerId, setPeriodOwnerId] = useState('');
  const [tracksMyPeriods, setTracksMyPeriods] = useState(false);
  const [partnerTracksPeriods, setPartnerTracksPeriods] = useState(false);
  const [cycleDatePickerKind, setCycleDatePickerKind] = useState<CycleDatePickerKind>(null);
  const [expandedCycleMonth, setExpandedCycleMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);
  const [periodDateText, setPeriodDateText] = useState(
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [periodTimeText, setPeriodTimeText] = useState(
    format(new Date(), 'HH:mm'),
  );
  const [selectedCycleDate, setSelectedCycleDate] = useState(
    format(new Date(), 'yyyy-MM-dd'),
  );
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [partnerTimeZone, setPartnerTimeZone] = useState(
    partner?.time_zone || 'UTC',
  );
  const [myTimeZone, setMyTimeZone] = useState('UTC');
  const [modal, setModal] = useState<ModalKind>(null);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [dateText, setDateText] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [timeText, setTimeText] = useState('18:00');
  const [category, setCategory] = useState<string>('note');
  const [eventKind, setEventKind] = useState('plan');
  const [linkUrl, setLinkUrl] = useState('');
  const dailyPrompt =
    DAILY_CONNECTION_PROMPTS[
      Math.floor(Date.now() / 86400000) % DAILY_CONNECTION_PROMPTS.length
    ];

  const load = useCallback(async () => {
    if (!coupleId || !user?.id) return;
    const [
      statusResult,
      eventResult,
      goalResult,
      noteResult,
      periodResult,
      preferenceResult,
      timezoneResult,
      linkResult,
      sketchResult,
      snapResult,
      streakResult,
    ] = await Promise.all([
      supabase.from('shared_statuses').select('*').eq('couple_id', coupleId),
      supabase
        .from('shared_calendar_events')
        .select('*')
        .eq('couple_id', coupleId)
        .gte('starts_at', new Date(Date.now() - 86400000).toISOString())
        .order('starts_at')
        .limit(30),
      supabase
        .from('shared_goals')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('shared_notes')
        .select('*')
        .eq('couple_id', coupleId)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(30),
      supabase
        .from('period_logs')
        .select('*')
        .eq('couple_id', coupleId)
        .order('period_start', { ascending: false })
        .limit(100),
      supabase
        .from('period_tracker_preferences')
        .select('user_id,share_with_partner,tracks_periods')
        .eq('couple_id', coupleId)
        .in('user_id', [user.id, ...(partner?.id ? [partner.id] : [])]),
      supabase
        .from('profiles')
        .select('id,time_zone')
        .in('id', [user.id, ...(partner?.id ? [partner.id] : [])]),
      supabase
        .from('shared_links')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('shared_sketchboards')
        .select('strokes')
        .eq('couple_id', coupleId)
        .maybeSingle(),
      supabase
        .from('shared_daily_snaps')
        .select(
          'id,user_id,checkin_date,status_text,image_path,created_at,expires_at',
        )
        .eq('couple_id', coupleId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('shared_daily_streak_days')
        .select('user_id,checkin_date')
        .eq('couple_id', coupleId)
        .order('checkin_date', { ascending: false }),
    ]);
    const failed = [
      statusResult,
      eventResult,
      goalResult,
      noteResult,
      periodResult,
      preferenceResult,
      timezoneResult,
      linkResult,
      sketchResult,
      snapResult,
      streakResult,
    ].find(result => result.error);
    if (failed?.error) throw failed.error;
    setStatuses(statusResult.data || []);
    setEvents(eventResult.data || []);
    setGoals(goalResult.data || []);
    setNotes(noteResult.data || []);
    setPeriods(periodResult.data || []);
    const signedSnaps = await Promise.all(
      (snapResult.data || []).map(async snap => ({
        ...snap,
        image: await getMediaUrl(snap.image_path, 5 * 60),
      })),
    );
    setDailySnaps(signedSnaps);
    setStreakDays(streakResult.data || []);
    const ownPreference = (preferenceResult.data || []).find(
      item => item.user_id === user.id,
    );
    const partnerPreference = (preferenceResult.data || []).find(
      item => item.user_id === partner?.id,
    );
    setSharePeriods(!!ownPreference?.share_with_partner);
    setPartnerSharesPeriods(!!partnerPreference?.share_with_partner);
    setTracksMyPeriods(ownPreference?.tracks_periods ?? (periodResult.data || []).some(row => row.user_id === user.id));
    setPartnerTracksPeriods(partnerPreference?.tracks_periods ?? (periodResult.data || []).some(row => row.user_id === partner?.id));
    const ownTracks = ownPreference?.tracks_periods ?? (periodResult.data || []).some(row => row.user_id === user.id);
    const partnerTracks = partnerPreference?.tracks_periods ?? (periodResult.data || []).some(row => row.user_id === partner?.id);
    const initialCycleOwner = ownTracks
      ? user.id
      : partnerTracks && partnerPreference?.share_with_partner && partner?.id
      ? partner.id
      : '';
    setPeriodOwnerId(current => {
      const currentAvailable =
        (current === user.id && ownTracks) ||
        (current === partner?.id && partnerTracks && !!partnerPreference?.share_with_partner);
      return currentAvailable ? current : initialCycleOwner;
    });
    for (const profile of timezoneResult.data || []) {
      if (profile.id === user.id) setMyTimeZone(profile.time_zone || 'UTC');
      if (profile.id === partner?.id)
        setPartnerTimeZone(profile.time_zone || 'UTC');
    }
    setLinks(linkResult.data || []);
    setStrokes((sketchResult.data?.strokes || []) as SketchStroke[]);
  }, [coupleId, partner?.id, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dailySnaps.length) return;
    const nextExpiry = Math.min(
      ...dailySnaps.map(snap => new Date(snap.expires_at).valueOf()),
    );
    const timeout = setTimeout(async () => {
      setDailySnaps(current =>
        current.filter(
          snap => new Date(snap.expires_at).valueOf() > Date.now(),
        ),
      );
      await supabase.functions
        .invoke('expire-daily-snaps')
        .catch(error => console.warn('Could not run snap cleanup', error));
      await load();
    }, Math.max(1000, nextExpiry - Date.now() + 250));
    return () => clearTimeout(timeout);
  }, [dailySnaps, load]);

  useEffect(() => {
    dailySnapsRef.current = dailySnaps;
  }, [dailySnaps]);

  useEffect(() => {
    const refresh = setInterval(() => {
      const currentSnaps = dailySnapsRef.current;
      if (!currentSnaps.length) return;
      void Promise.all(
        currentSnaps.map(async snap => ({
          id: snap.id,
          image: await getMediaUrl(snap.image_path, 5 * 60),
        })),
      )
        .then(urls =>
          setDailySnaps(current =>
            current.map(snap => ({
              ...snap,
              image:
                urls.find(item => item.id === snap.id)?.image || snap.image,
            })),
          ),
        )
        .catch(error => console.warn('Could not refresh snap images', error));
    }, 4 * 60 * 1000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    if (!coupleId || !user?.id) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setMyTimeZone(timezone);
    setPartnerTimeZone(partner?.time_zone || 'UTC');
    void supabase
      .from('profiles')
      .update({ time_zone: timezone })
      .eq('id', user.id);
    void supabase.functions
      .invoke('expire-daily-snaps')
      .catch(error => console.warn('Could not run snap cleanup', error));
    load()
      .catch(error =>
        toast(error.message || 'Could not load your shared space.'),
      )
      .finally(() => {
        if (mounted) setLoading(false);
      });
    const channel = supabase
      .channel(`together:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_statuses',
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          const changed = payload.new as StatusRow;
          if (!changed?.user_id) return;
          setStatuses(current => [
            ...current.filter(item => item.user_id !== changed.user_id),
            changed,
          ]);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_calendar_events',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_goals',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_notes',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_links',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'period_logs',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'period_tracker_preferences',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_sketchboards',
          filter: `couple_id=eq.${coupleId}`,
        },
        payload => {
          setStrokes(((payload.new as any)?.strokes || []) as SketchStroke[]);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_daily_snaps',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_daily_streak_days',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [coupleId, user?.id, load, toast]);

  const openModal = (kind: Exclude<ModalKind, null>) => {
    setModal(kind);
    setSnapImage(null);
    setTitle('');
    setDetails('');
    setLinkUrl('');
    setDateText(format(new Date(), 'yyyy-MM-dd'));
    setTimeText('18:00');
    setCategory(kind === 'note' ? 'note' : kind === 'link' ? 'watch' : 'note');
    setEventKind('plan');
  };

  const pickSnapImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!result.canceled && result.assets[0]?.uri)
          setSnapImage(result.assets[0].uri);
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted')
          return toast('Allow photo access to add a snap.');
        const result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.7,
        });
        if (!result.canceled && result.assets[0]?.uri)
          setSnapImage(result.assets[0].uri);
      }
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : 'Could not open the camera or photo library.',
      );
    }
  };

  const startNoteTemplate = (
    noteCategory: string,
    noteTitle: string,
    noteBody: string,
  ) => {
    openModal('note');
    setCategory(noteCategory);
    setTitle(noteTitle);
    setDetails(noteBody);
  };

  const saveModal = async () => {
    if (!user?.id || !coupleId) return;
    const cleanTitle = title.trim();
    if (
      modal !== 'status' &&
      modal !== 'snap' &&
      modal !== 'link' &&
      !cleanTitle
    )
      return toast('Add a title first.');
    if (modal === 'status' && !details.trim())
      return toast('Write a short status first.');
    if (modal === 'snap' && !snapImage)
      return toast('Choose a photo for your snap first.');
    if (
      modal === 'link' &&
      (!cleanTitle || !/^https?:\/\//i.test(linkUrl.trim()))
    )
      return toast('Add a title and a full https:// link.');
    setSaving(true);
    try {
      if (modal === 'status') {
        const { error } = await supabase.from('shared_statuses').upsert(
          {
            couple_id: coupleId,
            user_id: user.id,
            body: details.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'couple_id,user_id' },
        );
        if (error) throw error;
        setStatuses(current => [
          ...current.filter(item => item.user_id !== user.id),
          {
            id: current.find(item => item.user_id === user.id)?.id || 'local',
            couple_id: coupleId,
            user_id: user.id,
            body: details.trim(),
            updated_at: new Date().toISOString(),
          },
        ]);
      } else if (modal === 'snap') {
        const snapPath = await uploadImage(
          snapImage!,
          `${coupleId}/daily-snaps/${user.id}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.jpg`,
        );
        const checkinDate = format(new Date(), 'yyyy-MM-dd');
        const { error: snapError } = await supabase
          .from('shared_daily_snaps')
          .insert({
            couple_id: coupleId,
            user_id: user.id,
            checkin_date: checkinDate,
            status_text: details.trim(),
            image_path: snapPath,
          });
        if (snapError) throw snapError;
        const { error: streakError } = await supabase
          .from('shared_daily_streak_days')
          .upsert(
            {
              couple_id: coupleId,
              user_id: user.id,
              checkin_date: checkinDate,
            },
            { onConflict: 'user_id,checkin_date', ignoreDuplicates: true },
          );
        if (streakError) throw streakError;
      } else if (modal === 'event') {
        const startsAt = new Date(`${dateText.trim()}T${timeText.trim()}:00`);
        if (Number.isNaN(startsAt.valueOf()))
          throw new Error('Use date YYYY-MM-DD and time HH:MM.');
        const { error } = await supabase.from('shared_calendar_events').insert({
          couple_id: coupleId,
          created_by: user.id,
          title: cleanTitle,
          details: details.trim(),
          event_kind: eventKind,
          starts_at: startsAt.toISOString(),
          link_url: linkUrl.trim() || null,
        });
        if (error) throw error;
      } else if (modal === 'goal') {
        const { error } = await supabase.from('shared_goals').insert({
          couple_id: coupleId,
          created_by: user.id,
          title: cleanTitle,
          details: details.trim(),
          target_date: dateText.trim() || null,
        });
        if (error) throw error;
      } else if (modal === 'note') {
        const { error } = await supabase.from('shared_notes').insert({
          couple_id: coupleId,
          created_by: user.id,
          title: cleanTitle,
          content: details.trim(),
          category,
          link_url: linkUrl.trim() || null,
        });
        if (error) throw error;
      } else if (modal === 'link') {
        const { error } = await supabase.from('shared_links').insert({
          couple_id: coupleId,
          created_by: user.id,
          title: cleanTitle,
          url: linkUrl.trim(),
          kind: category,
        });
        if (error) throw error;
      }
      setModal(null);
      setSnapImage(null);
      if (modal !== 'status') await load();
    } catch (error: any) {
      toast(error.message || 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  };

  const myStatus = statuses.find(item => item.user_id === user?.id);
  const partnerStatus = statuses.find(item => item.user_id === partner?.id);
  const activePeriod = periods.find(
    period =>
      period.user_id === (periodOwnerId || user?.id) && !period.period_end,
  );
  const canManageSelectedCycle = periodOwnerId === user?.id
    ? tracksMyPeriods
    : !!partner?.id && periodOwnerId === partner.id && partnerTracksPeriods && partnerSharesPeriods;
  const upcomingEvents = useMemo(() => events.slice(0, 8), [events]);
  const visibleGoals = useMemo(
    () => goals.filter(goal => !goal.completed_at),
    [goals],
  );
  const myStreak = useMemo(
    () =>
      currentStreak(
        streakDays
          .filter(day => day.user_id === user?.id)
          .map(day => day.checkin_date),
      ),
    [streakDays, user?.id],
  );
  const partnerStreak = useMemo(
    () =>
      currentStreak(
        streakDays
          .filter(day => day.user_id === partner?.id)
          .map(day => day.checkin_date),
      ),
    [streakDays, partner?.id],
  );
  const selectedOwnerPeriods = useMemo(
    () =>
      periods
        .filter(row => row.user_id === periodOwnerId)
        .sort((a, b) => b.period_start.localeCompare(a.period_start)),
    [periods, periodOwnerId],
  );
  const latestSelectedPeriod = selectedOwnerPeriods[0];
  const selectedOwnerInsights = useMemo(
    () => getCycleInsights(selectedOwnerPeriods),
    [selectedOwnerPeriods],
  );
  const latestStartDate = latestSelectedPeriod
    ? latestSelectedPeriod.period_start_at
      ? format(new Date(latestSelectedPeriod.period_start_at), 'yyyy-MM-dd')
      : latestSelectedPeriod.period_start
    : null;
  const latestPeriodEndDate = latestSelectedPeriod
    ? latestSelectedPeriod.period_end_at
      ? format(new Date(latestSelectedPeriod.period_end_at), 'yyyy-MM-dd')
      : latestSelectedPeriod.period_end
    : null;
  const estimatedPeriodEnd = latestStartDate && selectedOwnerInsights.averagePeriodDays
    ? format(addDays(dateAtNoon(latestStartDate), selectedOwnerInsights.averagePeriodDays - 1), 'yyyy-MM-dd')
    : latestStartDate;
  const currentCyclePhase = latestStartDate
    ? cyclePhaseForDate(
        latestStartDate,
        activePeriod?.id === latestSelectedPeriod?.id
          ? format(new Date(), 'yyyy-MM-dd')
          : latestPeriodEndDate || estimatedPeriodEnd,
        selectedOwnerInsights.nextStart,
        format(new Date(), 'yyyy-MM-dd'),
      )
    : null;
  const predictionIsOverdue = !!selectedOwnerInsights.nextStart &&
    selectedOwnerInsights.nextStart < format(new Date(), 'yyyy-MM-dd');
  const cycleMarks = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const row of selectedOwnerPeriods) {
      const startDay = row.period_start_at
        ? format(new Date(row.period_start_at), 'yyyy-MM-dd')
        : row.period_start;
      const endDay = row.period_end_at
        ? format(new Date(row.period_end_at), 'yyyy-MM-dd')
        : row.period_end || startDay;
      let cursor = dateAtNoon(startDay);
      const finish = dateAtNoon(endDay);
      while (cursor <= finish) {
        const key = format(cursor, 'yyyy-MM-dd');
        marks[key] = {
          ...(marks[key] || {}),
          marked: true,
          dotColor: '#bd6971',
          ...(selectedCycleDate === key
            ? { selected: true, selectedColor: '#557b69' }
            : {}),
        };
        cursor = addDays(cursor, 1);
      }
    }
    if (selectedOwnerInsights.nextStart) {
      marks[selectedOwnerInsights.nextStart] = {
        ...(marks[selectedOwnerInsights.nextStart] || {}),
        marked: true,
        dotColor: '#78927d',
      };
    }
    if (!marks[selectedCycleDate])
      marks[selectedCycleDate] = { selected: true, selectedColor: '#557b69' };
    return marks;
  }, [
    selectedCycleDate,
    selectedOwnerInsights.nextStart,
    selectedOwnerPeriods,
  ]);
  const cycleMonthGroups = useMemo(() => {
    const groups = new Map<string, PeriodRow[]>();
    for (const row of periods) {
      const month = (row.period_start_at
        ? format(new Date(row.period_start_at), 'yyyy-MM')
        : row.period_start.slice(0, 7));
      groups.set(month, [...(groups.get(month) || []), row]);
    }
    return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left));
  }, [periods]);
  const writeStatus = async (body: string) => {
    if (!user?.id || !coupleId) return;
    try {
      const { error } = await supabase.from('shared_statuses').upsert(
        {
          couple_id: coupleId,
          user_id: user.id,
          body,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'couple_id,user_id' },
      );
      if (error) throw error;
      setStatuses(current => [
        ...current.filter(item => item.user_id !== user.id),
        {
          id: current.find(item => item.user_id === user.id)?.id || 'local',
          couple_id: coupleId,
          user_id: user.id,
          body,
          updated_at: new Date().toISOString(),
        },
      ]);
    } catch (error: any) {
      toast(error.message || 'Could not update your status.');
    }
  };

  const openCycleDatePicker = (kind: Exclude<CycleDatePickerKind, null>, row?: PeriodRow) => {
    const ownerId = periodOwnerId || user?.id;
    const ownerZone = ownerId === user?.id ? myTimeZone : partnerTimeZone;
    const todayForOwner = calendarDateInZone(new Date(), ownerZone);
    const dateInstant = kind === 'end' ? row?.period_end_at : row?.period_start_at;
    const storedDate = kind === 'end' ? row?.period_end : row?.period_start;
    const date = row
      ? dateInstant
        ? calendarDateInZone(new Date(dateInstant), ownerZone)
        : storedDate || todayForOwner
      : todayForOwner;
    const time = dateInstant
      ? new Intl.DateTimeFormat('en-GB', { timeZone: ownerZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(dateInstant))
      : new Intl.DateTimeFormat('en-GB', { timeZone: ownerZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    setPeriodDateText(date);
    setSelectedCycleDate(date);
    setPeriodTimeText(time);
    setEditingPeriodId(row?.id || null);
    setCycleDatePickerKind(kind);
  };

  const logPeriod = async () => {
    if (!user?.id || !coupleId) return;
    const ownerId = periodOwnerId || user.id;
    if (ownerId === user.id && !tracksMyPeriods)
      return toast('Turn on cycle tracking for yourself or choose a shared partner cycle.');
    if (ownerId !== user.id && !partnerTracksPeriods)
      return toast('Your partner has not enabled cycle tracking.');
    if (ownerId !== user.id && !partnerSharesPeriods)
      return toast('Your partner needs to enable cycle sharing first.');
    const ownerTimeZone = ownerId === user.id ? myTimeZone : partnerTimeZone;
    const parsedPeriodDate = dateTimeInZone(
      periodDateText,
      periodTimeText,
      ownerTimeZone,
    );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(periodDateText) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(periodTimeText) ||
      Number.isNaN(parsedPeriodDate.valueOf()) ||
      periodDateText > calendarDateInZone(new Date(), ownerTimeZone)
    )
      return toast('Choose a valid past or current date and time.');
    try {
      const result = editingPeriodId
        ? await supabase
            .from('period_logs')
            .update({
              period_start: periodDateText,
              period_start_at: parsedPeriodDate.toISOString(),
            })
            .eq('id', editingPeriodId)
        : await supabase.from('period_logs').upsert(
            {
              couple_id: coupleId,
              user_id: ownerId,
              period_start: periodDateText,
              period_start_at: parsedPeriodDate.toISOString(),
            },
            { onConflict: 'user_id,period_start' },
          );
      const { error } = result;
      if (error) throw error;
      setEditingPeriodId(null);
      setPeriodDateText(calendarDateInZone(new Date(), ownerTimeZone));
      setCycleDatePickerKind(null);
      await load();
      toast('Cycle date saved.');
    } catch (error: any) {
      toast(error.message || 'Could not save the date.');
    }
  };

  const endPeriod = async () => {
    const targetPeriod =
      selectedOwnerPeriods.find(row => row.id === editingPeriodId) ||
      selectedOwnerPeriods.find(row => row.id === activePeriod?.id) ||
      selectedOwnerPeriods.find(row => !row.period_end);
    if (!targetPeriod || !user?.id) return;
    if (targetPeriod.user_id === user.id && !tracksMyPeriods)
      return toast('Cycle tracking is turned off for this person.');
    if (targetPeriod.user_id !== user.id && !partnerSharesPeriods)
      return toast('Your partner needs to enable cycle sharing first.');
    const ownerTimeZone = targetPeriod.user_id === user.id ? myTimeZone : partnerTimeZone;
    const endInstant = dateTimeInZone(selectedCycleDate, periodTimeText, ownerTimeZone);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedCycleDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(periodTimeText) || selectedCycleDate > calendarDateInZone(new Date(), ownerTimeZone))
      return toast('Choose a valid past or current end date and time.');
    if (selectedCycleDate < (targetPeriod.period_end || targetPeriod.period_start))
      return toast('Choose an end date on or after the period started.');
    const { error } = await supabase
      .from('period_logs')
      .update({
        period_end: selectedCycleDate,
        period_end_at: endInstant.toISOString(),
      })
      .eq('id', targetPeriod.id);
    if (error) return toast(error.message || 'Could not save the end date.');
    setCycleDatePickerKind(null);
    await load();
    toast('Period end saved.');
  };

  const setPeriodSharing = async (enabled: boolean) => {
    if (!user?.id || !coupleId) return;
    if (enabled && !tracksMyPeriods) return toast('Turn on cycle tracking before sharing it.');
    try {
      const { error } = await supabase
        .from('period_tracker_preferences')
        .upsert(
          {
            user_id: user.id,
            couple_id: coupleId,
            share_with_partner: enabled,
            tracks_periods: tracksMyPeriods,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      setSharePeriods(enabled);
      await load();
    } catch (error: any) {
      toast(error.message || 'Could not update cycle privacy.');
    }
  };

  const setMyCycleTracking = async (enabled: boolean) => {
    if (!user?.id || !coupleId) return;
    const { error } = await supabase.from('period_tracker_preferences').upsert({
      user_id: user.id,
      couple_id: coupleId,
      share_with_partner: enabled ? sharePeriods : false,
      tracks_periods: enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) return toast(error.message || 'Could not update cycle settings.');
    setTracksMyPeriods(enabled);
    if (!enabled) setSharePeriods(false);
    if (!enabled && periodOwnerId === user.id) setPeriodOwnerId(partnerTracksPeriods && partnerSharesPeriods && partner?.id ? partner.id : '');
    if (enabled) setPeriodOwnerId(user.id);
  };

  const toggleGoal = async (goal: GoalRow) => {
    const completed = goal.completed_at ? null : new Date().toISOString();
    const { error } = await supabase
      .from('shared_goals')
      .update({ completed_at: completed })
      .eq('id', goal.id);
    if (error) return toast(error.message || 'Could not update goal.');
    setGoals(current =>
      current.map(item =>
        item.id === goal.id ? { ...item, completed_at: completed } : item,
      ),
    );
  };

  const pinNote = async (note: NoteRow) => {
    const { error } = await supabase
      .from('shared_notes')
      .update({ pinned: !note.pinned, updated_at: new Date().toISOString() })
      .eq('id', note.id);
    if (error) return toast(error.message || 'Could not pin this note.');
    setNotes(current =>
      current.map(item =>
        item.id === note.id ? { ...item, pinned: !note.pinned } : item,
      ),
    );
  };

  const saveStroke = async (points: SketchPoint[]) => {
    if (!coupleId || points.length === 0) return;
    const stroke: SketchStroke = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      color: inkColor,
      points,
    };
    const { data, error } = await supabase.rpc('append_shared_sketch_stroke', {
      target_couple: coupleId,
      stroke,
    });
    if (error) return toast(error.message || 'Could not save the sketch.');
    setStrokes((data || []) as SketchStroke[]);
  };

  const clearSketch = async () => {
    if (!coupleId) return;
    const { error } = await supabase.rpc('clear_shared_sketchboard', {
      target_couple: coupleId,
    });
    if (error) return toast(error.message || 'Could not clear the sketch.');
    setStrokes([]);
  };

  const pointFromEvent = (event: any): SketchPoint => ({
    x: Math.max(0, Math.min(1, event.nativeEvent.locationX / boardSize.width)),
    y: Math.max(0, Math.min(1, event.nativeEvent.locationY / boardSize.height)),
  });

  const drawStroke = (stroke: SketchStroke, key: string) => {
    if (!boardSize.width || !boardSize.height) return null;
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      return (
        <View
          key={`${key}-dot`}
          pointerEvents="none"
          style={[
            styles.sketchDot,
            {
              left: point.x * boardSize.width - 3,
              top: point.y * boardSize.height - 3,
              backgroundColor: stroke.color,
            },
          ]}
        />
      );
    }
    return stroke.points.slice(1).map((point, index) => {
      const previous = stroke.points[index];
      const x1 = previous.x * boardSize.width;
      const y1 = previous.y * boardSize.height;
      const x2 = point.x * boardSize.width;
      const y2 = point.y * boardSize.height;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      return (
        <View
          key={`${key}-line-${index}`}
          pointerEvents="none"
          style={[
            styles.sketchLine,
            {
              width: length,
              left: (x1 + x2) / 2 - length / 2,
              top: (y1 + y2) / 2 - 1.5,
              backgroundColor: stroke.color,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            },
          ]}
        />
      );
    });
  };

  if (!coupleId)
    return (
      <SafeAreaView style={styles.container}>
        <ScreenBackButton label="Home" />
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={42} color="#829087" />
          <Text style={styles.emptyTitle}>Connect with your person first</Text>
          <Text style={styles.emptyCopy}>
            Your shared calendar, plans, notes and status will live here.
          </Text>
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <LinearGradient
            colors={['#395c57', '#648477']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <ScreenBackButton label={isHub ? 'Home' : 'Our space'} light />
            <Text style={styles.eyebrow}>LIFE, SIDE BY SIDE</Text>
            <Text style={styles.title}>
              {isHub
                ? 'Your shared space'
                : section === 'connection'
                ? 'Check in with each other'
                : section === 'cycle'
                ? 'Cycle tracker'
                : section === 'planning'
                ? 'Plan your life'
                : section === 'notes'
                ? 'Your shared notebook'
                : 'Make time together'}
            </Text>
            <Text style={styles.heroCopy}>
              Make room for the everyday stuff and the future youâ€™re building
              together.
            </Text>
            {(showPlanning || isHub) && (
              <View style={styles.timeRow}>
                <View style={styles.timeChip}>
                  <Ionicons name="time-outline" size={15} color="#f8e8d9" />
                  <Text style={styles.timeName}>{user?.name || 'You'}</Text>
                  <Text style={styles.timeValue}>{localTime(myTimeZone)}</Text>
                </View>
                <View style={styles.timeChip}>
                  <Ionicons name="time-outline" size={15} color="#f8e8d9" />
                  <Text style={styles.timeName}>
                    {partner?.name || 'Partner'}
                  </Text>
                  <Text style={styles.timeValue}>
                    {localTime(partnerTimeZone)}
                  </Text>
                </View>
              </View>
            )}
            {(showPlanning || isHub) && (
              <Text style={styles.clockHint}>
                Local clocks Â· Updated {format(clock, 'h:mm a')}
              </Text>
            )}
          </LinearGradient>

          {isHub && (
            <View style={styles.spaceHub}>
              <Text style={styles.hubHeading}>What would you like to do?</Text>
              <Text style={styles.hubSubtitle}>
                Your shared tools, each with its own little corner.
              </Text>
              {[
                {
                  key: 'connection',
                  title: 'Everyday together',
                  subtitle: 'Daily status, a 24-hour snap, and a shared streak',
                  icon: 'heart-outline',
                  tint: '#f0dfdc',
                },
                {
                  key: 'planning',
                  title: 'Plan the everyday & future',
                  subtitle: 'Work schedules, calls, visits, shared goals',
                  icon: 'calendar-outline',
                  tint: '#e8eee7',
                },
                {
                  key: 'notes',
                  title: 'Notes & important plans',
                  subtitle: 'Immigration steps, checklists, shared notes',
                  icon: 'folder-open-outline',
                  tint: '#f2e8d8',
                },
                {
                  key: 'play',
                  title: 'Play, watch & create',
                  subtitle: 'Shared playlists, movies, and a live sketchpad',
                  icon: 'color-palette-outline',
                  tint: '#eee7f1',
                },
              ].map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.hubCard}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/Home/Together',
                      params: { section: item.key },
                    })
                  }
                >
                  <View
                    style={[styles.hubIcon, { backgroundColor: item.tint }]}
                  >
                    <Ionicons name={item.icon} size={21} color="#73585a" />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#a69a8f" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showConnection && (
            <>
              <SectionHead
                icon="radio-outline"
                title="What's on your mind?"
                subtitle="Share what you're doing or how company would feel."
              />
              <View style={styles.dailyPromptCard}>
                <View style={styles.dailyPromptIcon}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={20}
                    color="#a65f65"
                  />
                </View>
                <View style={styles.nudgeCopy}>
                  <Text style={styles.dailyPromptLabel}>
                    A small question for today
                  </Text>
                  <Text style={styles.dailyPromptText}>{dailyPrompt}</Text>
                </View>
                <TouchableOpacity
                  style={styles.nudgeButton}
                  onPress={() => {
                    setSnapImage(null);
                    setDetails(`${dailyPrompt}\n`);
                    setModal('status');
                  }}
                >
                  <Text style={styles.nudgeButtonText}>Answer</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.streakCard}>
                <View style={styles.streakHeader}>
                  <View style={styles.streakIcon}>
                    <Ionicons name="flame" size={20} color="#c36f4d" />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>
                      A small moment, every day
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      Text check-ins stay here; photo snaps disappear after 24
                      hours.
                    </Text>
                  </View>
                </View>
                <View style={styles.streakStats}>
                  <View style={styles.streakStat}>
                    <View style={styles.streakValue}>
                      <Ionicons name="flame" size={16} color="#c36f4d" />
                      <Text style={styles.streakNumber}>{myStreak}</Text>
                    </View>
                    <Text style={styles.streakName}>Your day streak</Text>
                  </View>
                  <View style={styles.streakDivider} />
                  <View style={styles.streakStat}>
                    <View style={styles.streakValue}>
                      <Ionicons name="flame" size={16} color="#c36f4d" />
                      <Text style={styles.streakNumber}>{partnerStreak}</Text>
                    </View>
                    <Text style={styles.streakName}>
                      {partner?.name || 'Partner'}'s streak
                    </Text>
                  </View>
                </View>
                <View style={styles.checkinActions}>
                  <TouchableOpacity
                    style={styles.shareSnapButton}
                    onPress={() => {
                      setDetails(myStatus?.body || '');
                      setModal('status');
                    }}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={18}
                      color="#fffdfa"
                    />
                    <Text style={styles.shareSnapText}>
                      Post a text check-in
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.snapOnlyButton}
                    onPress={() => {
                      setSnapImage(null);
                      setDetails(myStatus?.body || '');
                      setModal('snap');
                    }}
                  >
                    <Ionicons name="camera-outline" size={18} color="#73585a" />
                    <Text style={styles.snapOnlyText}>Share a snap</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.snapFeed}>
                <Text style={styles.snapFeedTitle}>Recent snaps</Text>
                {dailySnaps.length ? (
                  dailySnaps.map(snap => (
                    <View key={snap.id} style={styles.snapCard}>
                      <TouchableOpacity
                        style={styles.snapStory}
                        onPress={() => setOpenSnap(snap)}
                      >
                        <LinearGradient
                          colors={
                            snap.user_id === user?.id
                              ? ['#d58d80', '#a65f65']
                              : ['#72917d', '#395c57']
                          }
                          style={styles.snapStoryArt}
                        >
                          <Ionicons
                            name="image-outline"
                            size={25}
                            color="#fffdfa"
                          />
                          <Text style={styles.snapStoryOpen}>Tap to open</Text>
                        </LinearGradient>
                        <View style={styles.snapStoryCopy}>
                          <Text style={styles.rowTitle}>
                            {snap.user_id === user?.id
                              ? 'Your moment'
                              : `${partner?.name || 'Partner'}â€™s moment`}
                          </Text>
                          <Text
                            numberOfLines={2}
                            style={styles.snapStoryCaption}
                          >
                            {snap.status_text || 'A little glimpse of today'}
                          </Text>
                          <Text style={styles.snapExpiry}>
                            Disappears in{' '}
                            {formatDistanceToNow(new Date(snap.expires_at))}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#a69a8f"
                        />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptySnap}>
                    <Ionicons name="sunny-outline" size={22} color="#a65f65" />
                    <Text style={styles.emptySnapText}>
                      No snaps in the last 24 hours. Share a little moment to
                      start today's streak.
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.statusGrid}>
                <TouchableOpacity
                  style={styles.statusCard}
                  onPress={() => {
                    setModal('status');
                    setSnapImage(null);
                    setDetails(myStatus?.body || '');
                  }}
                >
                  <View style={styles.statusTop}>
                    <View style={[styles.avatarDot, styles.roseDot]}>
                      <Text style={styles.avatarLetter}>
                        {user?.name?.[0]?.toUpperCase() || 'Y'}
                      </Text>
                    </View>
                    <Text style={styles.statusName}>You</Text>
                    <Ionicons
                      name="create-outline"
                      size={17}
                      color="#a65f65"
                      style={{ marginLeft: 'auto' }}
                    />
                  </View>
                  <Text style={styles.statusBody}>
                    {myStatus?.body || 'Whatâ€™s on your mind?'}
                  </Text>
                  <Text style={styles.statusHint}>
                    {myStatus
                      ? `Updated ${format(
                          new Date(myStatus.updated_at),
                          'h:mm a',
                        )}`
                      : 'Tap to share a small update'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.statusCard}>
                  <View style={styles.statusTop}>
                    <View style={[styles.avatarDot, styles.sageDot]}>
                      <Text style={styles.avatarLetter}>
                        {partner?.name?.[0]?.toUpperCase() || 'P'}
                      </Text>
                    </View>
                    <Text style={styles.statusName}>
                      {partner?.name || 'Partner'}
                    </Text>
                    <View style={styles.liveDot} />
                  </View>
                  <Text style={styles.statusBody}>
                    {partnerStatus?.body || 'No check-in yet'}
                  </Text>
                  <Text style={styles.statusHint}>
                    {partnerStatus
                      ? `Updated ${format(
                          new Date(partnerStatus.updated_at),
                          'h:mm a',
                        )}`
                      : 'Whenever they feel like sharing'}
                  </Text>
                  {partnerStatus && (
                    <TouchableOpacity
                      style={styles.sayHello}
                      onPress={() => router.push('/(tabs)/Home/Chats')}
                    >
                      <Text style={styles.sayHelloText}>Say hello</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={12}
                        color="#a65f65"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={styles.nudgeCard}>
                <View style={styles.nudgeIcon}>
                  <Ionicons name="headset-outline" size={19} color="#73585a" />
                </View>
                <View style={styles.nudgeCopy}>
                  <Text style={styles.nudgeTitle}>Quiet company?</Text>
                  <Text style={styles.nudgeText}>
                    Let them know you're doing your own thing but would enjoy
                    being on call together.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.nudgeButton}
                  onPress={() =>
                    writeStatus('Doing my own thing, quiet company welcome')
                  }
                >
                  <Text style={styles.nudgeButtonText}>I'm in</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.quickStatuses}>
                {STATUS_PRESETS.map(preset => (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => writeStatus(preset)}
                    style={styles.preset}
                  >
                    <Text style={styles.presetText}>{preset}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {showCycle && (
            <>
              <SectionHead
                icon="heart-half-outline"
                title="Cycle tracker"
                subtitle="Optional, customizable, and shared only with permission."
              />
              <View style={styles.periodCard}>
                <View style={styles.periodHeader}>
                  <View style={styles.periodIcon}>
                    <Ionicons name="heart-half" size={20} color="#a65f65" />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Cycle tracking</Text>
                    <Text style={styles.rowSubtitle}>
                      I will learn from logged dates and refine the estimates over time.
                    </Text>
                  </View>
                </View>
                <View style={styles.shareRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Track periods for me</Text>
                    <Text style={styles.rowSubtitle}>A personal tracking preference, not a gender label. Turn it off to hide your cycle tab.</Text>
                  </View>
                  <TouchableOpacity style={[styles.switch, tracksMyPeriods && styles.switchOn]} onPress={() => void setMyCycleTracking(!tracksMyPeriods)}><View style={[styles.switchThumb, tracksMyPeriods && styles.switchThumbOn]} /></TouchableOpacity>
                </View>
                <Text style={styles.inputLabel}>
                  {tracksMyPeriods && partnerTracksPeriods && partnerSharesPeriods ? 'Choose a cycle' : tracksMyPeriods ? 'Your cycle' : partnerTracksPeriods ? 'Partner cycle' : 'No cycle tracking is enabled'}
                </Text>
                {!tracksMyPeriods && partnerTracksPeriods && !partnerSharesPeriods && <Text style={styles.emptyCycleHistory}>Your partner tracks a cycle but has not shared it with you.</Text>}
                <View style={styles.choiceRow}>
                  {[
                    { id: user?.id || '', name: user?.name || 'My cycle', allowed: tracksMyPeriods },
                    {
                      id: partner?.id || '',
                      name: `${partner?.name || 'Partner'} cycle`,
                      allowed: partnerTracksPeriods && partnerSharesPeriods,
                    },
                  ]
                    .filter(item => item.id && item.allowed)
                    .map(item => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => {
                          setPeriodOwnerId(item.id);
                          setEditingPeriodId(null);
                        }}
                        style={[
                          styles.choice,
                          periodOwnerId === item.id && styles.choiceSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            periodOwnerId === item.id &&
                              styles.choiceTextSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
                {canManageSelectedCycle && <View style={styles.cycleForecastCard}>
                  <View style={styles.cycleForecastIcon}><Ionicons name="sparkles-outline" size={18} color="#a65f65" /></View>
                  <View style={styles.cycleForecastCopy}>
                    <Text style={styles.cycleForecastTitle}>What your logs suggest</Text>
                    {selectedOwnerInsights.nextStart && !predictionIsOverdue ? <>
                      <Text style={styles.cycleForecastDate}>Next period may start from {format(addDays(dateAtNoon(selectedOwnerInsights.nextStart), -selectedOwnerInsights.estimateMarginDays), 'd MMM')} to {format(addDays(dateAtNoon(selectedOwnerInsights.nextStart), selectedOwnerInsights.estimateMarginDays), 'd MMM')}</Text>
                      <Text style={styles.cycleForecastBody}>Based on {selectedOwnerInsights.intervals.length} previous {selectedOwnerInsights.intervals.length === 1 ? 'cycle' : 'cycles'}; the typical interval is {selectedOwnerInsights.averageCycleDays} days between starts.</Text>
                    </> : selectedOwnerInsights.nextStart ? <Text style={styles.cycleForecastBody}>The estimated start window has passed. Log the next start when it happens to refresh predictions.</Text> : <Text style={styles.cycleForecastBody}>{selectedOwnerPeriods.length ? 'Log the next period start to learn the time between starts.' : 'Log period starts and ends to build a personal timeline.'}</Text>}
                    {selectedOwnerInsights.averagePeriodDays && <Text style={styles.cycleForecastBody}>Past logged periods usually lasted about {selectedOwnerInsights.averagePeriodDays} days.</Text>}
                    {currentCyclePhase && <Text style={styles.cycleForecastPhase}>Today: cycle day {currentCyclePhase.day} - {currentCyclePhase.phase}</Text>}
                    <Text style={styles.cycleForecastNote}>Estimates use this person's logged dates and can vary from month to month. Not for medical or contraception guidance.</Text>
                  </View>
                </View>}
                {canManageSelectedCycle && <TouchableOpacity style={styles.logPeriodButton} onPress={() => openCycleDatePicker('start')}>
                  <Ionicons name="calendar-outline" size={17} color="#fffdfa" />
                  <Text style={styles.logPeriodText}>{editingPeriodId ? 'Edit start date and time' : 'Log period start'}</Text>
                </TouchableOpacity>}
                {activePeriod && canManageSelectedCycle && (
                  <TouchableOpacity
                    style={styles.endPeriodButton}
                    onPress={() => openCycleDatePicker('end')}
                  >
                    <Text style={styles.endPeriodText}>
                      Choose period end date and time
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={styles.cycleHistory}>
                  <Text style={styles.cycleHistoryTitle}>Cycle history</Text>
                  <Text style={styles.cycleHistorySubtitle}>Choose a month, then open a cycle to explore its phases and gentle care ideas.</Text>
                  {cycleMonthGroups.filter(([, rows]) => rows.some(row => row.user_id === periodOwnerId)).map(([month, rows]) => {
                    const monthRows = rows.filter(row => row.user_id === periodOwnerId);
                    return <View key={month} style={styles.cycleMonthGroup}>
                      <TouchableOpacity style={styles.cycleMonthButton} onPress={() => setExpandedCycleMonth(current => current === month ? '' : month)}>
                        <View><Text style={styles.cycleMonthTitle}>{format(dateAtNoon(`${month}-01`), 'MMMM yyyy')}</Text><Text style={styles.cycleMonthCount}>{monthRows.length} {monthRows.length === 1 ? 'period log' : 'period logs'}</Text></View>
                        <Ionicons name={expandedCycleMonth === month ? 'chevron-up' : 'chevron-down'} size={19} color="#78927d" />
                      </TouchableOpacity>
                      {expandedCycleMonth === month && monthRows.map(period => {
                        const nextRow = selectedOwnerPeriods.find(row => row.period_start > period.period_start);
                        const startDate = period.period_start_at ? format(new Date(period.period_start_at), 'yyyy-MM-dd') : period.period_start;
                        const actualEndDate = period.period_end_at ? format(new Date(period.period_end_at), 'yyyy-MM-dd') : period.period_end;
                        const estimatedEndDate = actualEndDate || (selectedOwnerInsights.averagePeriodDays ? format(addDays(dateAtNoon(startDate), selectedOwnerInsights.averagePeriodDays - 1), 'yyyy-MM-dd') : null);
                        const nextStartDate = nextRow
                          ? nextRow.period_start_at ? format(new Date(nextRow.period_start_at), 'yyyy-MM-dd') : nextRow.period_start
                          : selectedOwnerInsights.averageCycleDays ? format(addDays(dateAtNoon(startDate), selectedOwnerInsights.averageCycleDays), 'yyyy-MM-dd') : null;
                        const actualCycleDays = nextRow ? differenceInCalendarDays(dateAtNoon(nextRow.period_start), dateAtNoon(period.period_start)) : selectedOwnerInsights.averageCycleDays;
                        const currentInfo = period.id === latestSelectedPeriod?.id
                          ? cyclePhaseForDate(startDate, activePeriod?.id === period.id ? format(new Date(), 'yyyy-MM-dd') : estimatedEndDate, selectedOwnerInsights.nextStart, format(new Date(), 'yyyy-MM-dd'))
                          : null;
                        const currentPhaseIndex = currentInfo ? ['Period', 'Follicular estimate', 'Ovulation window estimate', 'Luteal estimate'].indexOf(currentInfo.phase) : -1;
                        const isExpanded = expandedPeriodId === period.id;
                        const recordedDays = actualEndDate ? differenceInCalendarDays(dateAtNoon(actualEndDate), dateAtNoon(startDate)) + 1 : null;
                        const ovulationWindowStart = nextStartDate ? format(addDays(dateAtNoon(nextStartDate), -16), 'yyyy-MM-dd') : null;
                        const ovulationWindowEnd = nextStartDate ? format(addDays(dateAtNoon(nextStartDate), -10), 'yyyy-MM-dd') : null;
                        const phases = [
                          { name: 'Period', days: actualEndDate ? cycleDateRange(startDate, actualEndDate) : estimatedEndDate ? `${cycleDateRange(startDate, estimatedEndDate)} - estimated` : 'Log an end date to complete this entry', copy: 'The logged start and end dates define this phase. Comfort needs can differ each cycle.' },
                          { name: 'Follicular estimate', days: estimatedEndDate && ovulationWindowStart ? cycleDateRange(format(addDays(dateAtNoon(estimatedEndDate), 1), 'yyyy-MM-dd'), format(addDays(dateAtNoon(ovulationWindowStart), -1), 'yyyy-MM-dd')) : 'After the period ends', copy: 'This phase is estimated from the logged period and the predicted next start.' },
                          { name: 'Possible ovulation window', days: ovulationWindowStart && ovulationWindowEnd ? cycleDateRange(ovulationWindowStart, ovulationWindowEnd) : 'Needs another logged start', copy: 'A broad calendar estimate based on the next period prediction, not a confirmed ovulation date.' },
                          { name: 'Luteal estimate', days: ovulationWindowEnd && nextStartDate ? cycleDateRange(format(addDays(dateAtNoon(ovulationWindowEnd), 1), 'yyyy-MM-dd'), format(addDays(dateAtNoon(nextStartDate), -1), 'yyyy-MM-dd')) : 'After the estimated ovulation window', copy: 'Experiences vary. Use the estimate as a conversation prompt, not a rule about mood or energy.' },
                        ];
                        return <View key={period.id} style={styles.cycleEntryWrap}>
                          <TouchableOpacity style={styles.cycleEntry} onPress={() => setExpandedPeriodId(current => current === period.id ? null : period.id)}>
                            <View style={styles.cycleEntryIcon}><Ionicons name="heart-outline" size={17} color="#a65f65" /></View>
                            <View style={styles.rowCopy}>
                              <Text style={styles.cycleEntryTitle}>Period: {cycleDateRange(startDate, actualEndDate)}</Text>
                              <Text style={styles.rowSubtitle}>{actualCycleDays ? nextRow ? `${actualCycleDays}-day cycle; next start ${format(dateAtNoon(nextStartDate!), 'd MMM')}` : `Estimated ${actualCycleDays}-day cycle` : 'Log another period start to learn cycle timing'}</Text>
                              <Text style={styles.rowSubtitle}>{actualEndDate ? `${recordedDays} period days logged` : estimatedEndDate ? `Period in progress; likely ends around ${format(dateAtNoon(estimatedEndDate), 'd MMM')}` : 'Period in progress; add an end date when it finishes.'}</Text>
                              {currentInfo && <Text style={styles.phaseLabel}>Today: day {currentInfo.day} - {currentInfo.phase}</Text>}
                            </View>
                            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#78927d" />
                          </TouchableOpacity>
                          {isExpanded && <View style={styles.cycleDetails}>
                            <View style={styles.phaseTrack}>{phases.map((phase, index) => <View key={phase.name} style={[styles.phaseSegment, index === currentPhaseIndex && styles.phaseSegmentActive]} />)}</View>
                            {phases.map((phase, index) => <View key={phase.name} style={styles.phaseDetailRow}>
                              <View style={[styles.phaseBullet, index === currentPhaseIndex && styles.phaseBulletActive]} />
                              <View style={styles.rowCopy}><Text style={styles.phaseDetailTitle}>{phase.name} <Text style={styles.phaseDetailDays}> - {phase.days}</Text></Text><Text style={styles.phaseDetailCopy}>{phase.copy}</Text></View>
                            </View>)}
                            <View style={styles.careCard}><Ionicons name="sparkles-outline" size={17} color="#a65f65" /><Text style={styles.careCardText}>A thoughtful check-in: "What would feel supportive today?" Mood and energy vary from person to person.</Text></View>
                            {(period.user_id === user?.id || partnerSharesPeriods) && <>
                              <TouchableOpacity style={styles.editCycleButton} onPress={() => openCycleDatePicker('start', period)}><Text style={styles.linkText}>Edit start date and time</Text></TouchableOpacity>
                              {!!period.period_end && <TouchableOpacity style={styles.editCycleButton} onPress={() => openCycleDatePicker('end', period)}><Text style={styles.linkText}>Edit end date and time</Text></TouchableOpacity>}
                            </>}
                          </View>}
                        </View>;
                      })}
                    </View>;
                  })}
                  {!cycleMonthGroups.some(([, rows]) => rows.some(row => row.user_id === periodOwnerId)) && <Text style={styles.emptyCycleHistory}>No cycles recorded yet. Add a start date to begin a timeline.</Text>}
                </View>
                {tracksMyPeriods && <View style={styles.shareRow}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>
                      Let my partner see and edit my dates
                    </Text>
                    <Text style={styles.rowSubtitle}>
                      {sharePeriods
                        ? 'Your partner can view and update your cycle dates.'
                        : 'Your dates are private until you enable sharing.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.switch, sharePeriods && styles.switchOn]}
                    onPress={() => void setPeriodSharing(!sharePeriods)}
                  >
                    <View
                      style={[
                        styles.switchThumb,
                        sharePeriods && styles.switchThumbOn,
                      ]}
                    />
                  </TouchableOpacity>
                </View>}
                <Text style={styles.privacyHint}>
                  Cycle phases are rough calendar estimates, not medical
                  guidance or a fertility prediction.
                </Text>
              </View>
            </>
          )}

          {showPlanning && (
            <>
              <SectionHead
                icon="calendar-outline"
                title="Shared calendar"
                subtitle="Work shifts, calls, visits and the little plans."
                action="Add"
                onAction={() => {
                  openModal('event');
                }}
              />
              <View style={styles.panel}>
                {loading ? (
                  <ActivityIndicator color="#a65f65" />
                ) : upcomingEvents.length === 0 ? (
                  <EmptyLine text="Your plans will show up here." />
                ) : (
                  upcomingEvents.map(event => (
                    <View key={event.id} style={styles.listRow}>
                      <View
                        style={[
                          styles.eventBadge,
                          event.event_kind === 'work' && styles.workBadge,
                        ]}
                      >
                        <Ionicons
                          name={
                            event.event_kind === 'work'
                              ? 'briefcase-outline'
                              : event.event_kind === 'call'
                              ? 'call-outline'
                              : event.event_kind === 'watch'
                              ? 'film-outline'
                              : 'calendar-outline'
                          }
                          size={17}
                          color={
                            event.event_kind === 'work' ? '#597663' : '#a65f65'
                          }
                        />
                      </View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{event.title}</Text>
                        <Text style={styles.rowSubtitle}>
                          {eventDateLabel(event.starts_at)} Â·{' '}
                          {event.event_kind === 'work'
                            ? 'Work schedule'
                            : event.event_kind}
                        </Text>
                        {!!event.details && (
                          <Text numberOfLines={2} style={styles.rowDetail}>
                            {event.details}
                          </Text>
                        )}
                      </View>
                      {!!event.link_url && (
                        <TouchableOpacity
                          onPress={() => void Linking.openURL(event.link_url!)}
                        >
                          <Ionicons
                            name="open-outline"
                            size={18}
                            color="#72847b"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>

              <SectionHead
                icon="sparkles-outline"
                title="A future youâ€™re building"
                subtitle="Keep the shared hopes visible and make them actionable."
                action="Add a hope"
                onAction={() => openModal('goal')}
              />
              <View style={styles.panel}>
                {visibleGoals.length === 0 ? (
                  <EmptyLine text="Add a shared goal, from a visit to the life youâ€™re planning." />
                ) : (
                  visibleGoals.map(goal => (
                    <TouchableOpacity
                      key={goal.id}
                      style={styles.goalRow}
                      onPress={() => void toggleGoal(goal)}
                    >
                      <Ionicons
                        name="ellipse-outline"
                        size={22}
                        color="#a65f65"
                      />
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{goal.title}</Text>
                        {!!goal.details && (
                          <Text style={styles.rowSubtitle}>{goal.details}</Text>
                        )}
                        {!!goal.target_date && (
                          <Text style={styles.rowDate}>
                            Aiming for{' '}
                            {format(
                              new Date(`${goal.target_date}T12:00:00`),
                              'd MMM yyyy',
                            )}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.markDone}>Done</Text>
                    </TouchableOpacity>
                  ))
                )}
                {goals.some(goal => !!goal.completed_at) && (
                  <Text style={styles.completedHint}>
                    {goals.filter(goal => !!goal.completed_at).length} hope(s)
                    marked as reached
                  </Text>
                )}
              </View>
            </>
          )}

          {showNotes && (
            <>
              <SectionHead
                icon="file-tray-full-outline"
                title="Notes & plans"
                subtitle="A shared place for immigration steps, checklists and notes."
                action="Add note"
                onAction={() => openModal('note')}
              />
              <View style={styles.panel}>
                {notes.length === 0 ? (
                  <View style={styles.noteStarterWrap}>
                    <EmptyLine text="A shared notebook for the practical stuff youâ€™re carrying together." />
                    <TouchableOpacity
                      style={styles.noteStarter}
                      onPress={() =>
                        startNoteTemplate(
                          'immigration',
                          'Immigration timeline',
                          'Next step:\nOwner:\nDue date:\nDocuments or links:\nQuestions to ask:',
                        )
                      }
                    >
                      <Ionicons
                        name="airplane-outline"
                        size={18}
                        color="#73585a"
                      />
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>
                          Immigration timeline
                        </Text>
                        <Text style={styles.rowSubtitle}>
                          Steps, owners, links, and questions
                        </Text>
                      </View>
                      <Ionicons name="add" size={18} color="#a65f65" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.noteStarter}
                      onPress={() =>
                        startNoteTemplate(
                          'checklist',
                          'Document checklist',
                          'Document:\nWho has it:\nVerified on:\nExpiry or renewal date:\nNext action:',
                        )
                      }
                    >
                      <Ionicons
                        name="checkbox-outline"
                        size={18}
                        color="#73585a"
                      />
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>Document checklist</Text>
                        <Text style={styles.rowSubtitle}>
                          Track what you have and whatâ€™s next
                        </Text>
                      </View>
                      <Ionicons name="add" size={18} color="#a65f65" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.noteStarter}
                      onPress={() =>
                        startNoteTemplate(
                          'note',
                          'A note for us',
                          'What we want to remember:\n\nNext small step:',
                        )
                      }
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={18}
                        color="#73585a"
                      />
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>A note for us</Text>
                        <Text style={styles.rowSubtitle}>
                          Keep useful thoughts in one place
                        </Text>
                      </View>
                      <Ionicons name="add" size={18} color="#a65f65" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  notes.map(note => (
                    <View key={note.id} style={styles.noteRow}>
                      <View style={styles.noteIcon}>
                        <Ionicons
                          name={
                            note.category === 'immigration'
                              ? 'airplane-outline'
                              : note.category === 'checklist'
                              ? 'checkbox-outline'
                              : 'document-text-outline'
                          }
                          size={18}
                          color="#73585a"
                        />
                      </View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{note.title}</Text>
                        <Text style={styles.rowSubtitle}>
                          {note.category === 'immigration'
                            ? 'Immigration planning'
                            : note.category === 'checklist'
                            ? 'Checklist'
                            : 'Shared note'}
                        </Text>
                        {!!note.content && (
                          <Text numberOfLines={2} style={styles.rowDetail}>
                            {note.content}
                          </Text>
                        )}
                        {!!note.link_url && (
                          <TouchableOpacity
                            onPress={() => void Linking.openURL(note.link_url!)}
                          >
                            <Text style={styles.linkText}>
                              Open linked resource
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => void pinNote(note)}
                        accessibilityLabel={
                          note.pinned ? 'Unpin note' : 'Pin note'
                        }
                      >
                        <Ionicons
                          name={note.pinned ? 'bookmark' : 'bookmark-outline'}
                          size={19}
                          color={note.pinned ? '#a65f65' : '#9aaaa1'}
                        />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          {showPlay && (
            <>
              <SectionHead
                icon="play-circle-outline"
                title="Watch & listen together"
                subtitle="Keep the links close; open them in your chosen service."
                action="Add link"
                onAction={() => openModal('link')}
              />
              <View style={styles.panel}>
                {links.length === 0 ? (
                  <EmptyLine text="Save a movie, podcast, or playlist link to enjoy together." />
                ) : (
                  links.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.listRow}
                      onPress={() => void Linking.openURL(item.url)}
                    >
                      <View style={styles.linkIcon}>
                        <Ionicons
                          name={
                            item.kind === 'playlist'
                              ? 'musical-notes-outline'
                              : 'play-outline'
                          }
                          size={18}
                          color="#73585a"
                        />
                      </View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{item.title}</Text>
                        <Text numberOfLines={1} style={styles.rowSubtitle}>
                          {item.url}
                        </Text>
                      </View>
                      <Ionicons name="open-outline" size={18} color="#829087" />
                    </TouchableOpacity>
                  ))
                )}
                <Text style={styles.privacyHint}>
                  This saves and opens links. Synchronized playback or screen
                  sharing is not included.
                </Text>
              </View>

              <SectionHead
                icon="brush-outline"
                title="Sketch together"
                subtitle="Draw a little doodle; your partner sees each stroke."
                action="Clear"
                onAction={clearSketch}
              />
              <View style={styles.sketchPanel}>
                <View style={styles.sketchToolbar}>
                  <Text style={styles.sketchHint}>
                    Pick a color, then draw below
                  </Text>
                  <View style={styles.colorChoices}>
                    {['#a65f65', '#557b69', '#715c91', '#d28b48'].map(color => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setInkColor(color)}
                        style={[
                          styles.colorChoice,
                          { backgroundColor: color },
                          inkColor === color && styles.colorChoiceActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <View
                  style={styles.sketchBoard}
                  onLayout={event => {
                    setBoardSize({
                      width: event.nativeEvent.layout.width,
                      height: event.nativeEvent.layout.height,
                    });
                  }}
                  onStartShouldSetResponderCapture={() => true}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderTerminationRequest={() => false}
                  onResponderGrant={event => {
                    const point = pointFromEvent(event);
                    activeStrokeRef.current = [point];
                    setCurrentStroke([point]);
                  }}
                  onResponderMove={event => {
                    const point = pointFromEvent(event);
                    const previous =
                      activeStrokeRef.current[
                        activeStrokeRef.current.length - 1
                      ];
                    if (
                      !previous ||
                      Math.abs(point.x - previous.x) +
                        Math.abs(point.y - previous.y) >
                        0.003
                    ) {
                      activeStrokeRef.current = [
                        ...activeStrokeRef.current,
                        point,
                      ].slice(-500);
                      setCurrentStroke(activeStrokeRef.current);
                    }
                  }}
                  onResponderRelease={() => {
                    const points = activeStrokeRef.current;
                    activeStrokeRef.current = [];
                    setCurrentStroke([]);
                    void saveStroke(points);
                  }}
                  onResponderTerminate={() => {
                    activeStrokeRef.current = [];
                    setCurrentStroke([]);
                  }}
                >
                  {[
                    ...strokes,
                    ...(currentStroke.length
                      ? [
                          {
                            id: 'current',
                            color: inkColor,
                            points: currentStroke,
                          },
                        ]
                      : []),
                  ].map((stroke, index) =>
                    drawStroke(stroke, `${stroke.id}-${index}`),
                  )}
                  {strokes.length === 0 && currentStroke.length === 0 && (
                    <View pointerEvents="none" style={styles.sketchPlaceholder}>
                      <Ionicons
                        name="color-palette-outline"
                        size={22}
                        color="#a4aaa3"
                      />
                      <Text style={styles.sketchPlaceholderText}>
                        Your shared canvas is ready
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.footer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color="#6d8777"
                />
                <Text style={styles.footerText}>
                  Shared records are limited by active-couple database policies.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={modal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setModal(null)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.formCard}>
              <View style={styles.formHeading}>
                <View>
                  <Text style={styles.formTitle}>
                    {modal === 'status'
                      ? 'Your text check-in'
                      : modal === 'snap'
                      ? 'Share a 24-hour snap'
                      : modal === 'event'
                      ? 'Add to the calendar'
                      : modal === 'goal'
                      ? 'Add a shared hope'
                      : modal === 'note'
                      ? 'New shared note'
                      : 'Save a watch or playlist link'}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    Only your active shared space can see this.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setModal(null);
                    setSnapImage(null);
                  }}
                >
                  <Ionicons name="close" size={23} color="#819087" />
                </TouchableOpacity>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {modal === 'status' || modal === 'snap' ? (
                  <>
                    {modal === 'status' && (
                      <Text style={styles.inputLabel}>
                        Pick one or write your own
                      </Text>
                    )}
                    {modal === 'status' && (
                      <View style={styles.modalPresets}>
                        {STATUS_PRESETS.map(item => (
                          <TouchableOpacity
                            key={item}
                            style={styles.modalPreset}
                            onPress={() => setDetails(item)}
                          >
                            <Text style={styles.modalPresetText}>{item}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <TextInput
                      value={details}
                      onChangeText={setDetails}
                      maxLength={180}
                      placeholder="Whatâ€™s on your mind?"
                      placeholderTextColor="#a0aaa4"
                      style={styles.formInput}
                    />
                    {modal === 'snap' && (
                      <Text style={styles.inputLabel}>
                        Add a photo that disappears after 24 hours
                      </Text>
                    )}
                    {modal === 'snap' && snapImage ? (
                      <Image
                        source={{ uri: snapImage }}
                        style={styles.snapPreview}
                      />
                    ) : null}
                    {modal === 'snap' && (
                      <View style={styles.snapPickerRow}>
                        <TouchableOpacity
                          style={styles.snapPickerButton}
                          onPress={() => void pickSnapImage(true)}
                        >
                          <Ionicons
                            name="camera-outline"
                            size={18}
                            color="#6d8777"
                          />
                          <Text style={styles.snapPickerText}>Take a snap</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.snapPickerButton}
                          onPress={() => void pickSnapImage(false)}
                        >
                          <Ionicons
                            name="images-outline"
                            size={18}
                            color="#6d8777"
                          />
                          <Text style={styles.snapPickerText}>
                            Choose photo
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      maxLength={140}
                      placeholder={
                        modal === 'event'
                          ? 'Plan or shift title'
                          : modal === 'goal'
                          ? 'What are you hoping for?'
                          : modal === 'link'
                          ? 'Movie, podcast, or playlist name'
                          : 'Give this note a title'
                      }
                      placeholderTextColor="#a0aaa4"
                      style={styles.formInput}
                    />
                    {(modal === 'note' ||
                      modal === 'goal' ||
                      modal === 'event') && (
                      <TextInput
                        value={details}
                        onChangeText={setDetails}
                        multiline
                        placeholder={
                          modal === 'note'
                            ? 'Write details, steps, or anything you want to rememberâ€¦'
                            : modal === 'goal'
                            ? 'Add a little context (optional)'
                            : 'Details (optional)'
                        }
                        placeholderTextColor="#a0aaa4"
                        style={[styles.formInput, styles.multiline]}
                      />
                    )}
                    {(modal === 'event' || modal === 'goal') && (
                      <View style={styles.dateTimeRow}>
                        <TextInput
                          value={dateText}
                          onChangeText={setDateText}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#a0aaa4"
                          style={[styles.formInput, styles.dateInput]}
                        />
                        {modal === 'event' && (
                          <TextInput
                            value={timeText}
                            onChangeText={setTimeText}
                            placeholder="HH:MM"
                            placeholderTextColor="#a0aaa4"
                            style={[styles.formInput, styles.timeInput]}
                          />
                        )}
                      </View>
                    )}
                    {modal === 'event' && (
                      <View style={styles.choiceRow}>
                        {['plan', 'work', 'call', 'watch', 'reminder'].map(
                          kind => (
                            <TouchableOpacity
                              key={kind}
                              onPress={() => setEventKind(kind)}
                              style={[
                                styles.choice,
                                eventKind === kind && styles.choiceSelected,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.choiceText,
                                  eventKind === kind &&
                                    styles.choiceTextSelected,
                                ]}
                              >
                                {kind}
                              </Text>
                            </TouchableOpacity>
                          ),
                        )}
                      </View>
                    )}
                    {(modal === 'note' || modal === 'link') && (
                      <View style={styles.choiceRow}>
                        {(modal === 'note'
                          ? NOTE_CATEGORIES
                          : ['watch', 'playlist']
                        ).map(kind => (
                          <TouchableOpacity
                            key={kind}
                            onPress={() => setCategory(kind)}
                            style={[
                              styles.choice,
                              category === kind && styles.choiceSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.choiceText,
                                category === kind && styles.choiceTextSelected,
                              ]}
                            >
                              {kind}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {(modal === 'event' ||
                      modal === 'note' ||
                      modal === 'link') && (
                      <TextInput
                        value={linkUrl}
                        onChangeText={setLinkUrl}
                        autoCapitalize="none"
                        keyboardType="url"
                        placeholder={
                          modal === 'event'
                            ? 'Optional meeting or watch link'
                            : 'Optional https:// link'
                        }
                        placeholderTextColor="#a0aaa4"
                        style={styles.formInput}
                      />
                    )}
                  </>
                )}
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveDisabled]}
                  onPress={saveModal}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {modal === 'status'
                        ? 'Share check-in'
                        : modal === 'snap'
                        ? 'Share snap'
                        : 'Save to our space'}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={cycleDatePickerKind !== null} transparent animationType="slide" onRequestClose={() => setCycleDatePickerKind(null)} statusBarTranslucent>
        <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalBackdrop}>
            <View style={styles.cyclePickerSheet}>
              <View style={styles.formHeading}>
                <View><Text style={styles.formTitle}>{cycleDatePickerKind === 'end' ? 'When did the period end?' : editingPeriodId ? 'Edit period start' : 'When did the period start?'}</Text><Text style={styles.formSubtitle}>Choose a date and enter the time in {periodOwnerId === user?.id ? myTimeZone : partnerTimeZone}.</Text></View>
                <TouchableOpacity onPress={() => setCycleDatePickerKind(null)}><Ionicons name="close" size={23} color="#819087" /></TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Calendar
                key={`${cycleDatePickerKind}-${periodDateText.slice(0, 7)}`}
                current={periodDateText}
                markedDates={{ ...cycleMarks, [periodDateText]: { ...(cycleMarks[periodDateText] || {}), selected: true, selectedColor: '#557b69' } }}
                onDayPress={day => { setPeriodDateText(day.dateString); setSelectedCycleDate(day.dateString); }}
                enableSwipeMonths
                theme={{ backgroundColor: '#fffdfa', calendarBackground: '#fffdfa', textSectionTitleColor: '#829087', dayTextColor: '#4d5d55', monthTextColor: '#395c57', arrowColor: '#a65f65', todayTextColor: '#a65f65', selectedDayBackgroundColor: '#557b69', selectedDayTextColor: '#fffdfa', textDayFontWeight: '600', textMonthFontWeight: '800' }}
              />
              <Text style={styles.inputLabel}>Time · {periodOwnerId === user?.id ? myTimeZone : partnerTimeZone}</Text>
              <TextInput value={periodTimeText} onChangeText={setPeriodTimeText} placeholder="HH:MM" keyboardType="numbers-and-punctuation" placeholderTextColor="#a0aaa4" style={[styles.formInput, styles.timeInput]} />
              <TouchableOpacity style={styles.saveButton} onPress={() => cycleDatePickerKind === 'end' ? void endPeriod() : void logPeriod()}>
                <Text style={styles.saveButtonText}>{cycleDatePickerKind === 'end' ? 'Save period end' : editingPeriodId ? 'Save period start' : 'Save period start'}</Text>
              </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={!!openSnap}
        animationType="fade"
        onRequestClose={() => setOpenSnap(null)}
        statusBarTranslucent
      >
        <View style={styles.snapViewer}>
          <TouchableOpacity
            style={styles.snapViewerClose}
            onPress={() => setOpenSnap(null)}
          >
            <Ionicons name="close-circle" size={34} color="#fffdfa" />
          </TouchableOpacity>
          {openSnap && (
            <Image
              source={{ uri: openSnap.image }}
              resizeMode="contain"
              style={styles.snapViewerImage}
            />
          )}
          {openSnap && (
            <View style={styles.snapViewerCaption}>
              <Text style={styles.snapViewerName}>
                {openSnap.user_id === user?.id
                  ? 'Your moment'
                  : `${partner?.name || 'Partner'}â€™s moment`}
              </Text>
              <Text style={styles.snapViewerText}>{openSnap.status_text}</Text>
              <Text style={styles.snapViewerExpiry}>
                This snap disappears{' '}
                {formatDistanceToNow(new Date(openSnap.expires_at))} from now.
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function SectionHead({
  icon,
  title,
  subtitle,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={19} color="#a65f65" />
      </View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <View style={styles.emptyLine}>
      <Ionicons name="leaf-outline" size={17} color="#9ba99f" />
      <Text style={styles.emptyLineText}>{text}</Text>
    </View>
  );
}

export default TogetherScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f2eb' },
  content: { paddingBottom: 34 },
  hero: {
    paddingHorizontal: 21,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  eyebrow: {
    color: '#e6d5c6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginTop: 21,
  },
  title: { color: '#fffdfa', fontSize: 27, fontWeight: '800', marginTop: 5 },
  heroCopy: { color: '#f2e9df', fontSize: 13, lineHeight: 19, marginTop: 6 },
  timeRow: { flexDirection: 'row', gap: 9, marginTop: 17 },
  timeChip: {
    flex: 1,
    backgroundColor: '#ffffff1c',
    borderWidth: 1,
    borderColor: '#ffffff30',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeName: { color: '#f5e9df', fontSize: 11, flex: 1 },
  timeValue: { color: '#fff', fontWeight: '700', fontSize: 14 },
  clockHint: {
    color: '#e4d6cb',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 19,
    marginTop: 22,
    marginBottom: 10,
    gap: 10,
  },
  sectionIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: '#f0dfdc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: '#463e38', fontSize: 15, fontWeight: '800' },
  sectionSubtitle: { color: '#897c72', fontSize: 11, marginTop: 2 },
  sectionAction: {
    color: '#a65f65',
    fontSize: 12,
    fontWeight: '700',
    padding: 6,
  },
  statusGrid: { paddingHorizontal: 18, flexDirection: 'row', gap: 9 },
  dailyPromptCard: {
    marginHorizontal: 18,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#eadfe0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dailyPromptIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#f0dfdc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyPromptLabel: {
    color: '#a65f65',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  dailyPromptText: {
    color: '#4a413a',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 3,
  },
  streakCard: {
    marginHorizontal: 18,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#eadfe0',
  },
  streakHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#fff0e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eadfe0',
  },
  streakStat: { flex: 1, alignItems: 'center', gap: 3 },
  streakValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakNumber: { color: '#a65f65', fontSize: 17, fontWeight: '800' },
  streakName: { color: '#82766d', fontSize: 10 },
  streakDivider: { width: 1, height: 32, backgroundColor: '#eadfe0' },
  shareSnapButton: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: '#a65f65',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  shareSnapText: { color: '#fffdfa', fontSize: 12, fontWeight: '800' },
  snapFeed: { marginHorizontal: 18, marginTop: 5 },
  snapFeedTitle: {
    color: '#463e38',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 9,
  },
  checkinActions: { gap: 8, marginTop: 12 },
  snapOnlyButton: {
    minHeight: 43,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e5d9d5',
    backgroundColor: '#fffdfa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  snapOnlyText: { color: '#73585a', fontSize: 12, fontWeight: '800' },
  snapCard: {
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#e9dfd3',
    borderRadius: 18,
    padding: 9,
    marginBottom: 10,
  },
  snapStory: {
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#e9dfd3',
    borderRadius: 17,
    padding: 10,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  snapStoryArt: {
    width: 58,
    height: 66,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  snapStoryOpen: { color: '#fffdfa', fontSize: 8, fontWeight: '700' },
  snapStoryCopy: { flex: 1 },
  snapStoryCaption: { color: '#82766d', fontSize: 11, marginTop: 3 },
  snapViewer: {
    flex: 1,
    backgroundColor: '#151714',
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapViewerClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 2,
    padding: 8,
  },
  snapViewerImage: { width: '100%', height: '78%' },
  snapViewerCaption: {
    position: 'absolute',
    bottom: 36,
    left: 22,
    right: 22,
    padding: 16,
    borderRadius: 17,
    backgroundColor: '#222822eF',
  },
  snapViewerName: { color: '#fffdfa', fontSize: 15, fontWeight: '800' },
  snapViewerText: { color: '#fffdfa', fontSize: 13, marginTop: 5 },
  snapViewerExpiry: { color: '#c6cec5', fontSize: 10, marginTop: 7 },
  snapCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 9,
    paddingBottom: 3,
  },
  snapExpiry: { color: '#9a8e83', fontSize: 9 },
  emptySnap: {
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#e9dfd3',
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptySnapText: { color: '#82766d', flex: 1, fontSize: 11, lineHeight: 16 },
  statusCard: {
    flex: 1,
    backgroundColor: '#fffdfa',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#e9dfd3',
    padding: 12,
    minHeight: 114,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatarDot: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roseDot: { backgroundColor: '#f0dfdc' },
  sageDot: { backgroundColor: '#e4ece4' },
  avatarLetter: { fontSize: 12, color: '#60524e', fontWeight: '800' },
  statusName: { color: '#4a413a', fontSize: 12, fontWeight: '700', flex: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#78a48a' },
  statusBody: {
    color: '#4b504b',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 10,
  },
  statusHint: { color: '#978c83', fontSize: 10, marginTop: 5 },
  sayHello: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  sayHelloText: { color: '#a65f65', fontSize: 10, fontWeight: '700' },
  nudgeCard: {
    marginHorizontal: 18,
    marginTop: 11,
    backgroundColor: '#f2e8d8',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  nudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: '#fffdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeCopy: { flex: 1 },
  nudgeTitle: { color: '#514541', fontSize: 12, fontWeight: '800' },
  nudgeText: { color: '#85776d', fontSize: 10, lineHeight: 15, marginTop: 2 },
  nudgeButton: {
    backgroundColor: '#a65f65',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 13,
  },
  nudgeButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  quickStatuses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  preset: {
    borderRadius: 15,
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#e9dfd3',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  presetText: { color: '#6c665e', fontSize: 10 },
  panel: {
    marginHorizontal: 18,
    backgroundColor: '#fffdfa',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e9dfd3',
    paddingHorizontal: 13,
    paddingVertical: 3,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e9e4dc',
  },
  eventBadge: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: '#f7eae7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workBadge: { backgroundColor: '#e8eee7' },
  rowCopy: { flex: 1 },
  rowTitle: { color: '#4a413a', fontSize: 13, fontWeight: '700' },
  rowSubtitle: { color: '#82766d', fontSize: 10, marginTop: 3 },
  rowDetail: { color: '#6f6b65', fontSize: 11, lineHeight: 16, marginTop: 4 },
  rowDate: { color: '#a65f65', fontSize: 10, marginTop: 5, fontWeight: '600' },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e9e4dc',
  },
  markDone: { color: '#78927d', fontSize: 10, fontWeight: '700', padding: 5 },
  completedHint: { color: '#829087', fontSize: 10, paddingVertical: 8 },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e9e4dc',
  },
  noteStarterWrap: { paddingVertical: 4 },
  noteStarter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 13,
    backgroundColor: '#faf7f1',
    padding: 11,
    marginBottom: 7,
  },
  noteIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#f2e8d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { color: '#a65f65', fontSize: 10, fontWeight: '700', marginTop: 6 },
  periodCard: {
    marginHorizontal: 18,
    backgroundColor: '#fffdfa',
    borderWidth: 1,
    borderColor: '#eadfe0',
    borderRadius: 18,
    padding: 14,
  },
  periodHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cycleForecastCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 13, padding: 13, borderRadius: 16, backgroundColor: '#f8efed', borderWidth: 1, borderColor: '#efdfdd' },
  cycleForecastIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#fffdfa', alignItems: 'center', justifyContent: 'center' },
  cycleForecastCopy: { flex: 1 },
   cycleForecastTitle: { color: '#4a413a', fontSize: 13, fontWeight: '800' },
   cycleForecastDate: { color: '#a65f65', fontSize: 12, fontWeight: '800', marginTop: 7 },
   cycleForecastBody: { color: '#82766d', fontSize: 10, lineHeight: 15, marginTop: 5 },
   cycleForecastPhase: { color: '#5d7666', fontSize: 10, fontWeight: '700', marginTop: 6 },
   cycleForecastNote: { color: '#9b9085', fontSize: 9, lineHeight: 14, marginTop: 7 },
  cyclePickerSheet: { maxHeight: '92%', backgroundColor: '#fffdfa', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 30 },
  cycleHistory: { marginTop: 18, padding: 13, borderRadius: 17, backgroundColor: '#fbf8f3', borderWidth: 1, borderColor: '#eee7df' },
  cycleHistoryTitle: { color: '#4a413a', fontSize: 15, fontWeight: '800' },
  cycleHistorySubtitle: { color: '#82766d', fontSize: 10, lineHeight: 15, marginTop: 4, marginBottom: 10 },
  cycleMonthGroup: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5ddd5' },
  cycleMonthButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cycleMonthTitle: { color: '#4a413a', fontSize: 13, fontWeight: '800' },
  cycleMonthCount: { color: '#8b8076', fontSize: 10, marginTop: 2 },
  cycleEntryWrap: { marginBottom: 9, backgroundColor: '#fffdfa', borderRadius: 15, borderWidth: 1, borderColor: '#e9dfd3', overflow: 'hidden' },
  cycleEntry: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  cycleEntryIcon: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#f8e9e8', alignItems: 'center', justifyContent: 'center' },
  cycleEntryTitle: { color: '#4a413a', fontSize: 12, fontWeight: '800' },
  cycleDetails: { paddingHorizontal: 13, paddingBottom: 13 },
  phaseDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 11 },
  phaseBullet: { width: 8, height: 8, borderRadius: 4, marginTop: 4, backgroundColor: '#b39abe' },
  phaseBulletActive: { backgroundColor: '#bd6971' },
  phaseDetailTitle: { color: '#4a413a', fontSize: 11, fontWeight: '800' },
  phaseDetailDays: { color: '#887d73', fontWeight: '500' },
  phaseDetailCopy: { color: '#82766d', fontSize: 10, lineHeight: 15, marginTop: 2 },
  careCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, marginTop: 12, backgroundColor: '#f5ecee', borderRadius: 13 },
  careCardText: { flex: 1, color: '#765d62', fontSize: 10, lineHeight: 15 },
  editCycleButton: { alignSelf: 'flex-start', paddingTop: 8 },
  emptyCycleHistory: { color: '#82766d', fontSize: 11, lineHeight: 17, paddingVertical: 8 },
  phaseLabel: { color: '#829087', fontSize: 10, marginTop: 3 },
  phaseTrack: { flexDirection: 'row', gap: 4, marginTop: 7, marginRight: 14 },
  phaseSegment: {
    height: 5,
    flex: 1,
    borderRadius: 3,
    backgroundColor: '#e9e4dc',
  },
  phaseSegmentActive: { backgroundColor: '#a65f65' },
  periodIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: '#f8e9e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodActions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  logPeriodButton: {
    flex: 1,
    backgroundColor: '#a65f65',
    borderRadius: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  logPeriodText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  endPeriodButton: {
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    backgroundColor: '#f2e8d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endPeriodText: { color: '#755c56', fontSize: 11, fontWeight: '700' },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0e8e6',
    paddingTop: 12,
    marginTop: 13,
  },
  switch: {
    width: 42,
    height: 24,
    borderRadius: 13,
    backgroundColor: '#d9dedb',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: '#88a492' },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  privacyHint: { color: '#9a8e86', fontSize: 10, lineHeight: 15, marginTop: 9 },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: '#f2e8d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  emptyLineText: { color: '#8a8076', fontSize: 11, flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 22,
    marginTop: 18,
  },
  footerText: { color: '#829087', fontSize: 10 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: { color: '#463e38', fontSize: 18, fontWeight: '800' },
  emptyCopy: {
    color: '#82766d',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  sketchPanel: {
    marginHorizontal: 18,
    backgroundColor: '#fffdfa',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e9dfd3',
    padding: 11,
  },
  sketchToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
    paddingBottom: 9,
  },
  sketchHint: { color: '#82766d', fontSize: 10 },
  colorChoices: { flexDirection: 'row', gap: 8 },
  colorChoice: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fffdfa',
  },
  colorChoiceActive: { borderColor: '#453d38' },
  sketchBoard: {
    height: 210,
    backgroundColor: '#fbf8f3',
    borderWidth: 1,
    borderColor: '#eee7df',
    borderRadius: 13,
    overflow: 'hidden',
  },
  sketchSegment: { position: 'absolute', height: 3, borderRadius: 2 },
  sketchLine: { position: 'absolute', height: 4, borderRadius: 3 },
  sketchDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
  sketchPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  sketchPlaceholderText: { color: '#a09a91', fontSize: 11 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: { flex: 1, justifyContent: 'flex-end' },
  formCard: {
    backgroundColor: '#fffdfa',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  formHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  formTitle: { color: '#443c37', fontSize: 19, fontWeight: '800' },
  formSubtitle: { color: '#8a8076', fontSize: 11, marginTop: 4 },
  formInput: {
    backgroundColor: '#f7f4ef',
    borderWidth: 1,
    borderColor: '#e9dfd3',
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: '#403a35',
    fontSize: 13,
    marginBottom: 9,
  },
  snapPreview: {
    width: '100%',
    height: 150,
    borderRadius: 14,
    marginBottom: 8,
  },
  snapPickerRow: { flexDirection: 'row', gap: 8, marginBottom: 9 },
  snapPickerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#e8eee7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  snapPickerText: { color: '#5d7666', fontSize: 11, fontWeight: '700' },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  inputLabel: { fontSize: 11, color: '#7e746a', marginBottom: 8 },
  modalPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  modalPreset: {
    backgroundColor: '#f2e8d8',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  modalPresetText: { color: '#635751', fontSize: 10 },
  dateTimeRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1 },
  timeInput: { width: 95 },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginVertical: 4,
  },
  choice: {
    borderWidth: 1,
    borderColor: '#e4ddd3',
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  choiceSelected: { backgroundColor: '#f0dfdc', borderColor: '#d6a9a2' },
  choiceText: { color: '#776e65', fontSize: 10, textTransform: 'capitalize' },
  choiceTextSelected: { color: '#8b5054', fontWeight: '700' },
  saveButton: {
    minHeight: 47,
    backgroundColor: '#a65f65',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
  },
  saveDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fffdfa', fontSize: 13, fontWeight: '800' },
});
