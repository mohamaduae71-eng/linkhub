import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { StartupProfile, InvestorProfile } from '@/types';

const sectors = ['FinTech', 'HealthTech', 'EdTech', 'E-commerce', 'SaaS', 'AI/ML', 'Blockchain', 'Other'];
const stages = ['Idea', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
const investorTypes = ['Angel Investor', 'VC Fund', 'Corporate VC', 'Family Office', 'Other'];

export default function EditProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const styles = createStyles(colors);

  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [startupData, setStartupData] = useState<Partial<StartupProfile>>({});
  const [investorData, setInvestorData] = useState<Partial<InvestorProfile>>({});
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

  useEffect(() => {
    fetchProfileData();
  }, [profile]);

  const fetchProfileData = async () => {
    if (!profile) return;

    try {
      if (profile.role === 'startup') {
        const { data } = await supabase
          .from('startup_profiles')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (data) {
          setStartupData(data);
        }
      } else {
        const { data } = await supabase
          .from('investor_profiles')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (data) {
          setInvestorData(data);
          setSelectedSectors(data.sectors_of_interest || []);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSector = (sector: string) => {
    if (selectedSectors.includes(sector)) {
      setSelectedSectors(selectedSectors.filter((s) => s !== sector));
    } else {
      setSelectedSectors([...selectedSectors, sector]);
    }
  };

  const handleSave = async () => {
    if (!profile || !user) {
      setError('User not found. Please sign in again.');
      return;
    }

    // Validate required fields
    if (profile.role === 'startup') {
      if (!startupData.company_name || !startupData.sector || !startupData.location || !startupData.stage) {
        setError('Please fill in all required fields');
        return;
      }
    } else {
      if (!investorData.name || !investorData.investor_type || !investorData.location) {
        setError('Please fill in all required fields');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      if (profile.role === 'startup') {
        const profileData: any = {
          user_id: profile.id,
          company_name: startupData.company_name,
          sector: startupData.sector,
          location: startupData.location,
          stage: startupData.stage,
          funding_goal: startupData.funding_goal || 0,
          description: startupData.description || '',
          updated_at: new Date().toISOString(),
        };

        if (startupData.website) profileData.website = startupData.website;
        if (startupData.team_size) profileData.team_size = startupData.team_size;
        if (startupData.founded_year) profileData.founded_year = startupData.founded_year;

        console.log('Upserting startup profile:', { user_id: profile.id, profileData });
        
        // Use upsert to create if doesn't exist, update if it does
        const { data, error: upsertError } = await supabase
          .from('startup_profiles')
          .upsert(profileData, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        console.log('Upsert result:', { data, error: upsertError });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          throw upsertError;
        }

        if (!data) {
          throw new Error('Failed to save profile. Please try again.');
        }
      } else {
        const profileData: any = {
          user_id: profile.id,
          name: investorData.name,
          investor_type: investorData.investor_type,
          location: investorData.location,
          sectors_of_interest: selectedSectors,
          updated_at: new Date().toISOString(),
        };

        if (investorData.company) profileData.company = investorData.company;
        if (investorData.investment_range_min !== undefined) profileData.investment_range_min = investorData.investment_range_min;
        if (investorData.investment_range_max !== undefined) profileData.investment_range_max = investorData.investment_range_max;
        if (investorData.bio) profileData.bio = investorData.bio;

        console.log('Upserting investor profile:', { user_id: profile.id, profileData });
        
        // Use upsert to create if doesn't exist, update if it does
        const { data, error: upsertError } = await supabase
          .from('investor_profiles')
          .upsert(profileData, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        console.log('Upsert result:', { data, error: upsertError });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          throw upsertError;
        }

        if (!data) {
          throw new Error('Failed to save profile. Please try again.');
        }
      }

      // Refresh the auth profile
      await refreshProfile();
      
      // Navigate back - the profile screen will refresh via useFocusEffect
      router.back();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView style={styles.content}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {profile?.role === 'startup' ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Company Name *</Text>
                <TextInput
                  style={styles.input}
                  value={startupData.company_name || ''}
                  onChangeText={(text) =>
                    setStartupData({ ...startupData, company_name: text })
                  }
                  placeholder="Enter company name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Sector *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.pills}>
                    {sectors.map((sector) => (
                      <TouchableOpacity
                        key={sector}
                        style={[
                          styles.pill,
                          startupData.sector === sector && styles.pillSelected,
                        ]}
                        onPress={() =>
                          setStartupData({ ...startupData, sector })
                        }>
                        <Text
                          style={[
                            styles.pillText,
                            startupData.sector === sector &&
                              styles.pillTextSelected,
                          ]}>
                          {sector}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Location *</Text>
                <TextInput
                  style={styles.input}
                  value={startupData.location || ''}
                  onChangeText={(text) =>
                    setStartupData({ ...startupData, location: text })
                  }
                  placeholder="City, Country"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Stage *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.pills}>
                    {stages.map((stage) => (
                      <TouchableOpacity
                        key={stage}
                        style={[
                          styles.pill,
                          startupData.stage === stage && styles.pillSelected,
                        ]}
                        onPress={() => setStartupData({ ...startupData, stage })}>
                        <Text
                          style={[
                            styles.pillText,
                            startupData.stage === stage && styles.pillTextSelected,
                          ]}>
                          {stage}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Funding Goal (USD)</Text>
                <TextInput
                  style={styles.input}
                  value={startupData.funding_goal?.toString() || ''}
                  onChangeText={(text) =>
                    setStartupData({
                      ...startupData,
                      funding_goal: parseFloat(text) || 0,
                    })
                  }
                  placeholder="e.g., 500000"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={startupData.description || ''}
                  onChangeText={(text) =>
                    setStartupData({ ...startupData, description: text })
                  }
                  placeholder="Tell us about your company..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Website</Text>
                <TextInput
                  style={styles.input}
                  value={startupData.website || ''}
                  onChangeText={(text) =>
                    setStartupData({ ...startupData, website: text })
                  }
                  placeholder="https://example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>Team Size</Text>
                  <TextInput
                    style={styles.input}
                    value={startupData.team_size?.toString() || ''}
                    onChangeText={(text) =>
                      setStartupData({
                        ...startupData,
                        team_size: parseInt(text) || undefined,
                      })
                    }
                    placeholder="e.g., 5"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>Founded Year</Text>
                  <TextInput
                    style={styles.input}
                    value={startupData.founded_year?.toString() || ''}
                    onChangeText={(text) =>
                      setStartupData({
                        ...startupData,
                        founded_year: parseInt(text) || undefined,
                      })
                    }
                    placeholder="e.g., 2023"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={investorData.name || ''}
                  onChangeText={(text) =>
                    setInvestorData({ ...investorData, name: text })
                  }
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Company / Fund</Text>
                <TextInput
                  style={styles.input}
                  value={investorData.company || ''}
                  onChangeText={(text) =>
                    setInvestorData({ ...investorData, company: text })
                  }
                  placeholder="Enter company name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Investor Type *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.pills}>
                    {investorTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.pill,
                          investorData.investor_type === type &&
                            styles.pillSelected,
                        ]}
                        onPress={() =>
                          setInvestorData({ ...investorData, investor_type: type })
                        }>
                        <Text
                          style={[
                            styles.pillText,
                            investorData.investor_type === type &&
                              styles.pillTextSelected,
                          ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Location *</Text>
                <TextInput
                  style={styles.input}
                  value={investorData.location || ''}
                  onChangeText={(text) =>
                    setInvestorData({ ...investorData, location: text })
                  }
                  placeholder="City, Country"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>Min Investment</Text>
                  <TextInput
                    style={styles.input}
                    value={investorData.investment_range_min?.toString() || ''}
                    onChangeText={(text) =>
                      setInvestorData({
                        ...investorData,
                        investment_range_min: parseFloat(text) || undefined,
                      })
                    }
                    placeholder="50000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.field, styles.flex1]}>
                  <Text style={styles.label}>Max Investment</Text>
                  <TextInput
                    style={styles.input}
                    value={investorData.investment_range_max?.toString() || ''}
                    onChangeText={(text) =>
                      setInvestorData({
                        ...investorData,
                        investment_range_max: parseFloat(text) || undefined,
                      })
                    }
                    placeholder="500000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Sectors of Interest</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.pills}>
                    {sectors.map((sector) => (
                      <TouchableOpacity
                        key={sector}
                        style={[
                          styles.pill,
                          selectedSectors.includes(sector) && styles.pillSelected,
                        ]}
                        onPress={() => toggleSector(sector)}>
                        <Text
                          style={[
                            styles.pillText,
                            selectedSectors.includes(sector) &&
                              styles.pillTextSelected,
                          ]}>
                          {sector}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={investorData.bio || ''}
                  onChangeText={(text) =>
                    setInvestorData({ ...investorData, bio: text })
                  }
                  placeholder="Tell startups about yourself..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: typeof Colors.light) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: 24,
    },
    field: {
      marginBottom: 24,
      gap: 8,
    },
    row: {
      flexDirection: 'row',
      gap: 16,
    },
    flex1: {
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
    pills: {
      flexDirection: 'row',
      gap: 8,
    },
    pill: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    pillSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    pillTextSelected: {
      color: '#FFFFFF',
    },
    saveButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 48,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
      padding: 8,
      backgroundColor: `${colors.error}15`,
      borderRadius: 8,
      marginBottom: 16,
    },
  });
}
