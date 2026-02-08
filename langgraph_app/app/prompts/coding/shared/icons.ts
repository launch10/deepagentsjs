/**
 * Component guidelines for landing page development.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const iconsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
    ### Icons

    Use **lucide-react** for all icons. Import by PascalCase name:
    \`import { ArrowRight, Check, Star } from 'lucide-react'\`

    **Common landing page icons — use these directly, no tool needed:**

    | Category | Icons |
    |----------|-------|
    | Navigation | Menu, X, ChevronDown, ChevronRight, ArrowRight, ArrowLeft, ExternalLink |
    | Actions | Check, CheckCircle, Plus, Minus, Search, Filter, Download, Upload, Send |
    | Communication | Mail, MessageSquare, MessageCircle, Phone, Video, Headphones |
    | People | User, Users, UserPlus, UserCheck, Heart, ThumbsUp |
    | Time | Clock, Calendar, CalendarDays, Timer, History, Hourglass |
    | Business | BarChart, BarChart3, TrendingUp, DollarSign, CreditCard, Receipt, Briefcase |
    | Security | Shield, ShieldCheck, Lock, Unlock, Key, Eye, EyeOff |
    | Tech | Globe, Wifi, Cloud, Server, Database, Code, Terminal, Cpu, Zap |
    | Status | AlertCircle, AlertTriangle, Info, HelpCircle, Ban, CircleCheck, CircleX |
    | Content | FileText, Image, Bookmark, Tag, Hash, Link, Paperclip, Clipboard |
    | Layout | LayoutGrid, Layers, Columns, Rows, Grid, Table |
    | Social | Share2, Github, Twitter, Linkedin, Facebook |
    | Misc | Star, Sparkles, Flame, Target, Trophy, Award, Gift, MapPin, Compass, Rocket |

    **Only use \`searchIcons\` for unusual or domain-specific icons** where the common ones above don't fit.
    Do NOT grep or search the codebase for icon imports.
`;
